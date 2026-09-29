import Hero from "../components/Hero";
import CategoryCard from "../components/CategoryCard";
import ProductSection from "../components/ProductSection";
import SeasonalSection from "../components/SeasonalSection";
import WhyChooseUs from "../components/WhyChooseUs";
import Testimonials from "../components/Testimonials";
import CTASection from "../components/CTASection";
import { categories } from "../data/products";

function Home() {
  return (
    <>
      <Hero />

      {/* Shop by category */}
      <section className="bg-sand-50 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">
              Shop by category
            </p>

            <h2 className="mt-3 font-display text-3xl font-bold text-sand-900 sm:text-4xl">
              Agricultural solutions
            </h2>

            <p className="mt-4 text-sand-600">
              Everything you need to plan, sow and protect a season.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {categories.map((category, i) => (
              <CategoryCard key={category.id} category={category} index={i} />
            ))}
          </div>
        </div>
      </section>

      <ProductSection />

      <SeasonalSection />

      <WhyChooseUs />

      <Testimonials />

      <CTASection />
    </>
  );
}

export default Home;
