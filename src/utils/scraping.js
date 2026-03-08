export async function scrape(link) {
	const response = await fetch(link);
	const data = await response.json();

	const companies = data.pageProps.strapi.startups.data.map((item) => ({
		name: item.attributes.name,
		description: item.attributes.description,
		website: item.attributes.websiteUrl,
		isUnicorn: item.attributes.isUnicorn,
		imageLink: item.attributes.logo?.data?.attributes?.url ?? null,
	}));

	return companies;
}
