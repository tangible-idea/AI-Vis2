/**
 * Trends abstraction. Google Trends has no official API, so the MVP ships
 * a curated mock source; swap in a real implementation (SerpAPI, Glimpse,
 * DataForSEO) by implementing TrendsSource and returning it below.
 */
export interface TrendTopic {
  topic: string;
  change: number; // % interest change, e.g. 140 = +140%
  volume: string; // human label, e.g. "12K searches/mo"
  contentAngle: string; // suggested content idea for Optimize
}

export interface TrendsSource {
  name: string;
  topicsFor(industry: string, country: string): Promise<TrendTopic[]>;
}

class MockTrendsSource implements TrendsSource {
  name = "mock";
  async topicsFor(industry: string): Promise<TrendTopic[]> {
    const ind = industry.trim();
    return [
      {
        topic: `best ${ind} for small business`,
        change: 145,
        volume: "8.1K/mo",
        contentAngle: `Category page: "Best ${ind} solutions for small business"`,
      },
      {
        topic: `${ind} pricing comparison`,
        change: 92,
        volume: "5.4K/mo",
        contentAngle: `Comparison page with transparent pricing table`,
      },
      {
        topic: `ai ${ind} tools`,
        change: 210,
        volume: "12.9K/mo",
        contentAngle: `Blog post: "How AI is changing ${ind} in 2026"`,
      },
      {
        topic: `${ind} alternatives`,
        change: 38,
        volume: "3.2K/mo",
        contentAngle: `Alternatives page targeting competitor switchers`,
      },
      {
        topic: `is ${ind} worth it`,
        change: 61,
        volume: "2.7K/mo",
        contentAngle: `FAQ entry answering ROI questions directly`,
      },
    ];
  }
}

export function getTrendsSource(): TrendsSource {
  return new MockTrendsSource();
}
