import { scrape } from '../utils/scraping.js';
import { saveCompanies } from '../services/save.js';

export async function scrapeCompanies( headers, env) {
	try {
		const LINK = "https://initialized.com/_next/data/Kdh5Cchru7oIUM6m3ZU-a/index.json"
		const companies = await scrape(LINK);
		const saved = await saveCompanies(companies, env);

		return new Response(JSON.stringify({
			message: `Saved ${saved.length} companies`,
			companies: saved,
		}), {
			status: 200,
			headers,
		});
	} catch (err) {
		return new Response(
			JSON.stringify({ error: 'Scrape failed', details: String(err) }),
			{
				status: 400,
				headers,
			},
		);
	}
}


/*Used Firecrawl to scrape the Initialized Capital portfolio page
If implementing programmatically, would use: 
import { FirecrawlApp } from '@mendable/firecrawl-js';
import Firecrawl from '@mendable/firecrawl-js';
import { z } from 'zod';

const firecrawl = new Firecrawl({ apiKey: 'your-api-key' });

const result = await firecrawl.agent({
  prompt: "Extract company data from the Initialized Capital portfolio page. For each of the 150+ companies, capture the name, website URL, logo, and description from the hover modals. Include a boolean field indicating if the company is a unicorn.",
  schema: z.object({
      initialized_capital_companies: z.array(z.object({
        name: z.string().describe("Company name"),
        website_url: z.string().describe("Company website URL"),
        logo_url: z.string().describe("URL of the company logo"),
        description: z.string().describe("Company description from the hover modal"),
        is_unicorn: z.boolean().describe("Indicates if the company is a unicorn"),
      })).describe("List of companies from the Initialized Capital portfolio")
    }),
  urls: ["https://initialized.com/companies"],
  model: 'spark-1-mini',
});
*/