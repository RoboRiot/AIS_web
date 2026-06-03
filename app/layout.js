import Header from '@/components/header/Header';
import Footer from '@/components/footer/Footer';
import '@/styles/globals.scss'
import { BASE_URL } from "@/app/data/seoProducts";

export const metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "Advanced Imaging | CT, MRI & Mobile Imaging Services",
    template: "%s",
  },
  description: "Advanced Imaging provides CT, MRI, PET/CT, parts, service, and mobile imaging trailer support for hospitals and imaging centers across the United States.",
  alternates: {
    canonical: "/",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">

      <script type="text/javascript" id="hs-script-loader" async defer src="//js-na2.hs-scripts.com/242600993.js"></script>

      <body>
        <div className='body-wrapper'>
          <Header />
          {children}
          <Footer />
        </div>
      </body>
    </html>
  );
}
