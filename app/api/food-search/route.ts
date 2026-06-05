export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();
  if (!query || query.length < 2) return Response.json({ products: [] });

  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=8&fields=product_name,brands,nutriments`,
      { next: { revalidate: 60 } }
    );
    const data = await res.json();

    const products = (data.products ?? [])
      .filter(
        (p: Record<string, unknown>) =>
          p.product_name &&
          (p.nutriments as Record<string, number>)?.["energy-kcal_100g"] > 0
      )
      .slice(0, 6)
      .map((p: Record<string, unknown>) => {
        const n = p.nutriments as Record<string, number>;
        const brand = typeof p.brands === "string" ? p.brands.split(",")[0].trim() : "";
        return {
          name: `${p.product_name}${brand ? ` (${brand})` : ""}`,
          calories: Math.round(n["energy-kcal_100g"] ?? 0),
          protein: Math.round(n["proteins_100g"] ?? 0),
          carbs: Math.round(n["carbohydrates_100g"] ?? 0),
          fat: Math.round(n["fat_100g"] ?? 0),
        };
      });

    return Response.json({ products });
  } catch {
    return Response.json({ products: [] });
  }
}
