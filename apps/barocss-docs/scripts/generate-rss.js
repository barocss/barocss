import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// RSS feed generation
function generateRSSFeed() {
  const blogDir = join(__dirname, '../docs/blog')
  const posts = []
  
  function scanDirectory(dir, year = null) {
    const items = readdirSync(dir)
    
    for (const item of items) {
      const fullPath = join(dir, item)
      const stat = statSync(fullPath)
      
      if (stat.isDirectory()) {
        if (/^\d{4}$/.test(item)) {
          scanDirectory(fullPath, item)
        }
      } else if (item.endsWith('.md') && item !== 'index.md') {
        const content = readFileSync(fullPath, 'utf-8')
        const { metadata } = extractMetadata(content)
        
        if (metadata.title) {
          const relativePath = fullPath.replace(join(__dirname, '../docs'), '').replace('.md', '')
          posts.push({
            ...metadata,
            path: relativePath,
            year: year || new Date(metadata.date).getFullYear()
          })
        }
      }
    }
  }
  
  scanDirectory(blogDir)
  
  // Sort posts by date (newest first)
  posts.sort((a, b) => new Date(b.date) - new Date(a.date))
  
  // Generate RSS XML
  const rssContent = generateRSSXML(posts)
  
  // Write RSS file
  const rssPath = join(__dirname, '../docs/blog/feed.xml')
  writeFileSync(rssPath, rssContent)
  console.log('RSS feed generated successfully!')
}

// Extract metadata from markdown files
function extractMetadata(content) {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/
  const match = content.match(frontmatterRegex)
  
  if (!match) return { metadata: {}, content }
  
  const frontmatter = match[1]
  const markdownContent = match[2]
  
  const metadata = {}
  const lines = frontmatter.split('\n')
  
  for (const line of lines) {
    const [key, ...valueParts] = line.split(':')
    if (key && valueParts.length > 0) {
      const value = valueParts.join(':').trim()
      
      // Handle array values (YAML format)
      if (value.startsWith('[') && value.endsWith(']')) {
        try {
          metadata[key.trim()] = JSON.parse(value)
        } catch (e) {
          // Handle YAML array format like [item1, item2, item3]
          const arrayContent = value.slice(1, -1)
          metadata[key.trim()] = arrayContent.split(',').map(item => item.trim())
        }
      } else {
        metadata[key.trim()] = value
      }
    }
  }
  
  return { metadata, content: markdownContent }
}

// Generate RSS XML content
function generateRSSXML(posts) {
  const siteUrl = 'https://barocss.com'
  const blogUrl = `${siteUrl}/blog`
  const feedUrl = `${blogUrl}/feed.xml`
  
  const now = new Date().toUTCString()
  
  let rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>BaroCSS Blog</title>
    <description>Latest updates, tutorials, and insights about BaroCSS</description>
    <link>${blogUrl}</link>
    <atom:link href="${feedUrl}" rel="self" type="application/rss+xml"/>
    <language>en-US</language>
    <lastBuildDate>${now}</lastBuildDate>
    <generator>BaroCSS RSS Generator</generator>
`

  // Add posts
  posts.slice(0, 20).forEach(post => {
    const postUrl = `${siteUrl}${post.path}`
    const pubDate = new Date(post.date).toUTCString()
    const description = post.description || 'Read more about this post on the BaroCSS blog.'
    
    rss += `    <item>
      <title><![CDATA[${post.title}]]></title>
      <description><![CDATA[${description}]]></description>
      <link>${postUrl}</link>
      <guid isPermaLink="true">${postUrl}</guid>
      <pubDate>${pubDate}</pubDate>
      <author><![CDATA[${post.author || 'BaroCSS Team'}]]></author>
`
    
    // Add categories
    if (post.category) {
      rss += `      <category><![CDATA[${post.category}]]></category>
`
    }
    
    // Add tags
    if (post.tags && Array.isArray(post.tags)) {
      post.tags.forEach(tag => {
        rss += `      <category><![CDATA[${tag}]]></category>
`
      })
    }
    
    rss += `    </item>
`
  })
  
  rss += `  </channel>
</rss>`
  
  return rss
}

// Run the script
generateRSSFeed()
