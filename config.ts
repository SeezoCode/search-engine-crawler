export const elasticAddress: string = "http://localhost:9200"
export const timeUntilReindex: number = 1000 * 60 * 60 * 24 * 7 // 1 week
export const elasticIndex: string = "se12"
export const startingUrls: string[] = [
    "https://mozilla.org",
    "https://www.goodreads.com",
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
]
export const maxDepth: number = 10
export const maxPages: number = 10000
export const domainLimit: number | null = 50
export const visitExternalDomains: boolean = true

// leaves Chromium process running after closing (uncomment lines in main.ts)
// export const concurrency: number | null = null
