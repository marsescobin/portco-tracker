Initialized AI Engineer
Take-Home Assignment

Duration: 2–3 hours (expected)
Compensation: This is a paid assignment. We will pay you $300 for your time.
Stack: Your choice. Use whatever languages, frameworks, and tools you work fastest in.
AI Tools: Encouraged.

Introduction
Initialized is a seed-stage venture firm with a portfolio of 200+ companies. Staying on top of
news and developments across our portfolio is one of the most important—and most
time-consuming—things our team does.
Your task is to build a Portfolio News Tracker: a deployed web application that scrapes our
portfolio from our website, fetches recent news mentions for each company, uses an LLM to
generate summaries of that news, and presents everything in a clean, usable interface.
This is representative of real work you’d do in this role—taking a business need, building a
full-stack solution with AI, and deploying it so the team can use it.
Requirements
1. Scrape the Initialized Portfolio
Visit initialized.com and extract our portfolio companies. For each company, capture whatever
structured data is available (name, description, sector, URL, etc.). Store this in a real database
(PostgreSQL, MySQL, or similar—not SQLite).
2. Fetch News Mentions
For each portfolio company, fetch recent news mentions. You can use any approach: a news
API (NewsAPI, Google News, Bing News, etc.), RSS feeds, or web scraping. The goal is to
associate each company with recent, relevant articles.
3. AI-Powered Summaries
Use an LLM (OpenAI, Anthropic, or similar) to generate a brief news summary for each
company based on its recent mentions. The summary should give a reader a quick sense of
what’s happening with that company—think 2–3 sentences, not a wall of text.

4. Web Interface
Build a web interface that displays the portfolio companies and their news. At minimum:
• A list or grid of portfolio companies
• Each company’s recent news mentions with links to the source articles
• The AI-generated summary for each company
• A way to refresh news (a button, endpoint, or scheduled job)
Design doesn’t need to be award-winning, but it should be clean and usable. Think “internal tool
a team actually uses” not “marketing page.”
5. Deploy It
Deploy the application to a live URL that anyone on our team can access. Use whatever
platform you prefer (Railway, Render, Fly.io, Vercel + managed DB, AWS, etc.). The database
must be a hosted/managed instance—not a local file.

Instructions
1. Build the application and deploy it to a live URL.
2. Push your code to a GitHub repository (public or private—if private, invite brettg).
3. Include a README with: how to run it locally, your deployed URL, which AI tools you
used during development, and any decisions or trade-offs worth noting.
4. Submit the GitHub repo link and deployed URL to Tiffany (tiffany@initialized.com).
Evaluation
Your submission will be evaluated on:
• Does it work? Can we open the URL, see your portfolio companies, their news, and AI
summaries?
• Data pipeline. How did you approach scraping, news fetching, and data modeling? Is
the schema sensible?
• AI integration. Are the LLM-generated summaries useful? Is the prompt well-designed?
How do you handle edge cases (rate limits, empty results, bad responses)?
• Code quality. Is the code well-organized and readable? Does it reflect good engineering
instincts, regardless of what stack you chose?
• Deployment & infrastructure. Is it deployed with a real database? Could we point our
team at this and have them use it?
• Velocity & tool use. We’ll look at your git history and README to understand how you
used AI tools to move fast. We value speed and resourcefulness, not hand-typing every
line.

What Happens Next
Once you’ve read through the instructions, let Tiffany (tiffany@initialized.com) know when you
think you will be able to complete it, and please feel free to communicate any updates.
After you submit, we’ll schedule an in-office review with Brett Gibson, Managing Partner and the
solo software engineer on our team. This conversation will be a chance for you to walk through
the choices you made, problems you ran into, how you used AI tools, and where you’d take this
next.