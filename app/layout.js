import Header from '@/components/header/Header';
import Footer from '@/components/footer/Footer';
import '@/styles/globals.scss'

export const metadata = {
  title: "Advanced Imaging - World's leading CT and MRI scanning equipment.",
  description: "Advanced Imaging - World's leading CT and MRI scanning equipment.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className='body-wrapper'>
          <Header/>
          {children}
          <Footer/>
        </div>
      </body>
    </html>
  );
}
