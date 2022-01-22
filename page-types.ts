interface PageMetadata {
    title?: string,
    author?: string,
    description?: string,
    openGraphImgURL?: string,
    openGraphTitle?: string,
    type?: string,
    tags?: Array<string>,
    siteName?: string
    hasIcon: boolean,
    language?: string | null,
}

export interface PageBodyHeadings {
    h1?: Array<string>
    h2?: Array<string>
    h3?: Array<string>
    h4?: Array<string>
    h5?: Array<string>
    h6?: Array<string>
}

export interface PageLink {
    innerText: string,
    href: string,
    bias: number
}

interface PageBody {
    headings: PageBodyHeadings
    plaintext?: Array<string>
    article?: string | null
    internalLinks?: Array<PageLink>
    externalLinks?: Array<PageLink>
    imgLinks?: Array<string>
}

export interface Page {
    metadata: PageMetadata
    body: PageBody

    url: string
    crawlerTimestamp: number
    userRating: number
    bias: number
    createdTimestamp?: number
}
