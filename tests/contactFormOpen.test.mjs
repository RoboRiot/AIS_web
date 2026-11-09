import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../app/contact/page.js", import.meta.url), "utf8");
const start = source.indexOf("export default function Contact() {");
const end = source.indexOf("  const copy = FORM_COPY[formType]", start);
assert.ok(start >= 0 && end > start, "Contact initialization hooks must be available for the lifecycle regression");
// Run the actual initialization hooks; omit JSX and submit handlers. No form or network request is made.
const initialization = source.slice(start, end).replace("export default ", "") + "\n}";

function contactLifecycle(search) {
  const states = [], setters = [], dependencies = [], announcements = [];
  let cursor = 0, dirty = false, pending = [], setLeadId;
  const createLeadId = () => "initial-test-lead";
  const context = vm.createContext({
    window: { location: { search } }, process: { env: {} }, URLSearchParams,
    FORM_LIMITS: { partNumber: 100, message: 1600 },
    useLocalFormPreview: () => false,
    createLeadId,
    ensureRecaptchaScript() {},
    announceFormOpen: (...args) => announcements.push(args),
    useState(initial) {
      const index = cursor++;
      if (!(index in states)) {
        states[index] = typeof initial === "function" ? initial() : initial;
        setters[index] = value => {
          const next = typeof value === "function" ? value(states[index]) : value;
          if (!Object.is(next, states[index])) { states[index] = next; dirty = true; }
        };
        if (initial === createLeadId) setLeadId = setters[index];
      }
      return [states[index], setters[index]];
    },
    useEffect(effect, nextDependencies) {
      const index = cursor++;
      const previous = dependencies[index];
      if (!previous || nextDependencies.some((value, position) => !Object.is(value, previous[position]))) {
        dependencies[index] = nextDependencies;
        pending.push(effect);
      }
    },
  });
  vm.runInContext(initialization, context);
  const render = () => {
    let renders = 0;
    do {
      assert.ok(++renders <= 10, "Contact initialization must settle");
      cursor = 0; dirty = false; pending = [];
      context.Contact();
      for (const effect of pending) effect();
    } while (dirty);
  };
  return { announcements, render, newLead(id) { setLeadId(id); render(); } };
}

test("plain contact load announces once after initialization, ordinary rerenders announce nothing, and a new lead announces once", () => {
  const contact = contactLifecycle("");
  contact.render();
  assert.deepEqual(contact.announcements, [["contact_form", "contact_page", "initial-test-lead"]]);
  contact.render();
  assert.equal(contact.announcements.length, 1);
  contact.newLead("next-test-lead");
  assert.deepEqual(contact.announcements, [
    ["contact_form", "contact_page", "initial-test-lead"],
    ["contact_form", "contact_page", "next-test-lead"],
  ]);
});

test("specialized contact URLs announce only their initialized form type and source", () => {
  for (const [inquiry, formType] of [
    ["service", "service_request"], ["trailer", "trailer_request"],
    ["parts", "part_request"], ["part", "part_request"],
  ]) {
    const contact = contactLifecycle(`?inquiry=${inquiry}&source=regression-source&pn=test-part&message=test-message`);
    contact.render();
    assert.deepEqual(contact.announcements, [[formType, "regression-source", "initial-test-lead"]]);
    contact.render();
    assert.equal(contact.announcements.length, 1);
    contact.newLead("next-test-lead");
    assert.deepEqual(contact.announcements.at(-1), [formType, "regression-source", "next-test-lead"]);
    assert.equal(contact.announcements.length, 2);
  }
});
