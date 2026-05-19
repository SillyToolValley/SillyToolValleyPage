# Crawl Policy

This site is public so people can read, cite, and share Silly Tool Valley pages.
However, Silly Tool Valley reserves text-and-data-mining and AI training use.

## Implemented signals

- `robots.txt` allows ordinary public search, but disallows known AI, agent, dataset, and bulk extraction crawlers.
- `Content-Signal: search=yes, ai-train=no, ai-input=no` declares that search indexing is allowed while AI training and AI answer ingestion are not.
- `/.well-known/tdmrep.json` declares `tdm-reservation: 1` for the site.
- Public HTML pages include `tdm-reservation` and `ai-training` meta tags.

## Limits

These controls are voluntary signals for compliant crawlers. They do not stop
manual downloads, browser automation, user-agent spoofing, proxy rotation, or
scrapers that ignore `robots.txt`.

For technical enforcement, the content must be served behind a platform that can
run WAF rules, bot management, rate limits, or authenticated/signed requests.
