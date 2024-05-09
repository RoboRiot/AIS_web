import Subheader from '@/components/subheader/Subheader';
import SearchProduct from './SearchProduct';
import productsData from "@/app/home/part-card/partCardList.json";

export default function Search() {
  return (
    <>
      <Subheader
          title="Search"
          extraClass="services_bg"
      />
      <SearchProduct products={productsData}/>
    </>
  );
};
