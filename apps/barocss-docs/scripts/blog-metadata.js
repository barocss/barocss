import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Blog metadata extraction and processing
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

// Generate blog index with metadata
function generateBlogIndex() {
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
  
  // Generate categories and tags
  const categories = [...new Set(posts.map(p => p.category).filter(Boolean))]
  const tags = [...new Set(posts.flatMap(p => p.tags || []))]
  
  return { posts, categories, tags }
}

// Generate tag cloud HTML
function generateTagCloud(tags, posts) {
  // Count tag usage
  const tagCounts = {}
  posts.forEach(post => {
    (post.tags || []).forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1
    })
  })
  
  // Sort tags by usage count
  const sortedTags = tags.sort((a, b) => tagCounts[b] - tagCounts[a])
  
  // Determine tag size based on usage
  const getTagSize = (count) => {
    if (count >= 3) return 'tag-large'
    if (count >= 2) return 'tag-medium'
    return 'tag-small'
  }
  
  return sortedTags.map(tag => {
    const count = tagCounts[tag]
    const size = getTagSize(count)
    return `<a href="/blog/tags/${tag}" class="tag-link ${size}">${tag}</a>`
  }).join('\n    ')
}

// Update blog index page
function updateBlogIndex() {
  const { posts, categories, tags } = generateBlogIndex()
  const blogIndexPath = join(__dirname, '../docs/blog/index.md')
  
  let content = `---
title: Blog
description: Latest updates, tutorials, and insights about BaroCSS
---

<div class="blog-layout">
  <div class="blog-header">
    <h1>BaroCSS Blog</h1>
    <p>Stay updated with the latest news, tutorials, and insights about BaroCSS. Discover new features, best practices, and community stories.</p>
    <div class="blog-subscribe">
      <a href="/blog/feed.xml" class="rss-link" title="Subscribe to RSS feed">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6.503 20.752c0 1.794-1.456 3.248-3.251 3.248S0 22.546 0 20.752s1.456-3.248 3.252-3.248 3.251 1.454 3.251 3.248zM2.111 0C9.465 0 16.9 7.434 16.9 16.788h-3.252C13.648 10.28 8.62 5.252 2.111 5.252V0zm0 5.252c5.238 0 9.49 4.252 9.49 9.49h-3.252c0-3.446-2.792-6.238-6.238-6.238V5.252z"/>
        </svg>
        RSS Feed
      </a>
    </div>
  </div>

  <div class="blog-posts-list">`

  // Add latest posts
  posts.slice(0, 5).forEach(post => {
    const date = new Date(post.date)
    const formattedDate = date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    })
    
    content += `
    <article class="blog-post-item">
      <div class="blog-post-meta">
        <span class="blog-post-date">${formattedDate}</span>
        <span class="blog-post-category">${post.category || 'General'}</span>
      </div>
      <h2 class="blog-post-title">
        <a href="${post.path}">${post.title}</a>
      </h2>
      <p class="blog-post-excerpt">
        ${post.description || ''}
      </p>
      <div class="blog-post-tags">
        ${(post.tags || []).map(tag => `<a href="/blog/tags/${tag}" class="blog-post-tag">${tag}</a>`).join('')}
      </div>
    </article>`
  })

  content += `
  </div>

  <div class="blog-categories">
    ${categories.map(cat => `<a href="/blog/category/${cat}" class="blog-category-link">${cat.charAt(0).toUpperCase() + cat.slice(1)}</a>`).join('')}
    <a href="/blog/tags/" class="blog-category-link">All Tags</a>
  </div>

  <div class="blog-archive">
    <h3>Archive</h3>
    <div class="blog-archive-links">
      ${[...new Set(posts.map(p => p.year))].sort((a, b) => b - a).map(year => `<a href="/blog/${year}" class="blog-archive-link">${year}</a>`).join('')}
    </div>
  </div>
</div>`

  writeFileSync(blogIndexPath, content)
  console.log('Blog index updated successfully!')
}

// Generate individual tag pages
function generateTagPages(posts) {
  // Group posts by tag
  const tagPosts = {}
  posts.forEach(post => {
    (post.tags || []).forEach(tag => {
      if (!tagPosts[tag]) {
        tagPosts[tag] = []
      }
      tagPosts[tag].push(post)
    })
  })
  
  // Create individual tag pages
  Object.entries(tagPosts).forEach(([tag, tagPostsList]) => {
    const tagPagePath = join(__dirname, `../docs/blog/tags/${tag}.md`)
    
    // Sort posts by date (newest first)
    tagPostsList.sort((a, b) => new Date(b.date) - new Date(a.date))
    
    const formattedDate = (date) => {
      return new Date(date).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      })
    }
    
    const postsMarkdown = tagPostsList.map(post => {
      const tagsMarkdown = (post.tags || []).map(t => `[${t}](/blog/tags/${t})`).join(' ')
      return `## [${post.title}](${post.path})

**${formattedDate(post.date)}** • **${post.category || 'General'}**

${post.description || ''}

**Tags:** ${tagsMarkdown}

---`
    }).join('\n\n')
    
    const content = `---
title: Posts tagged with "${tag}"
description: All blog posts tagged with ${tag}
---

# Posts tagged with "${tag}"

${postsMarkdown}

<div class="back-to-blog">
  <a href="/blog/" class="back-link">← Back to Blog</a>
</div>

<style>
.back-to-blog {
  text-align: center;
  margin: 3rem 0;
}

.back-link {
  display: inline-block;
  padding: 0.75rem 1.5rem;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  text-decoration: none;
  border-radius: 8px;
  border: 1px solid var(--vp-c-divider);
  transition: all 0.2s ease;
  font-weight: 500;
}

.back-link:hover {
  background: var(--vp-c-brand);
  color: white;
  border-color: var(--vp-c-brand);
}
</style>`
    
    writeFileSync(tagPagePath, content)
  })
  
  console.log(`Generated ${Object.keys(tagPosts).length} individual tag pages`)
}

// Generate tags index page
function generateTagsIndex() {
  const { posts, tags } = generateBlogIndex()
  const tagsIndexPath = join(__dirname, '../docs/blog/tags/index.md')
  
  // Count tag usage
  const tagCounts = {}
  posts.forEach(post => {
    (post.tags || []).forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1
    })
  })
  
  const totalTags = tags.length
  const totalPosts = posts.length
  
  const tagCloud = generateTagCloud(tags, posts)
  
  const content = `---
title: All Tags
description: Browse all blog posts by tags
---

<div class="tags-header">
  <h1>All Tags</h1>
  <p>Browse blog posts by tags to find content that interests you. Click on any tag to see related posts.</p>
  <div class="tags-stats">
    <div class="stat-item">
      <span class="stat-number">${totalTags}</span>
      <span class="stat-label">Total Tags</span>
    </div>
    <div class="stat-item">
      <span class="stat-number">${totalPosts}</span>
      <span class="stat-label">Blog Posts</span>
    </div>
  </div>
</div>

<div class="tags-container">
  <div class="tag-cloud">
    ${tagCloud}
  </div>
</div>

<style>
.tags-header {
  text-align: center;
  margin-bottom: 3rem;
  padding: 2rem 0;
}

.tags-header h1 {
  font-size: 2.5rem;
  font-weight: 700;
  margin-bottom: 1rem;
  background: linear-gradient(135deg, var(--vp-c-brand) 0%, #667eea 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.tags-header p {
  font-size: 1.1rem;
  color: var(--vp-c-text-2);
  max-width: 600px;
  margin: 0 auto 2rem auto;
  line-height: 1.6;
}

.tags-stats {
  display: flex;
  justify-content: center;
  gap: 3rem;
  margin-top: 2rem;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.stat-number {
  font-size: 2rem;
  font-weight: 700;
  color: var(--vp-c-brand);
  line-height: 1;
}

.stat-label {
  font-size: 0.9rem;
  color: var(--vp-c-text-3);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.tags-container {
  max-width: 1000px;
  margin: 3rem auto;
  padding: 0 1rem;
}

.tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  justify-content: center;
  align-items: center;
}

.tag-link {
  display: inline-block;
  padding: 0.75rem 1.5rem;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  text-decoration: none;
  border-radius: 8px;
  border: 1px solid var(--vp-c-divider);
  transition: all 0.2s ease;
  font-weight: 500;
}

.tag-link:hover {
  background: #3b82f6;
  color: white !important;
  border-color: #3b82f6;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

/* Size variants */
.tag-large {
  font-size: 1.1rem;
  padding: 0.9rem 1.8rem;
}

.tag-medium {
  font-size: 1rem;
  padding: 0.8rem 1.6rem;
}

.tag-small {
  font-size: 0.9rem;
  padding: 0.7rem 1.4rem;
}

/* Responsive design */
@media (max-width: 768px) {
  .tags-header h1 {
    font-size: 2rem;
  }
  
  .tags-header p {
    font-size: 1rem;
    padding: 0 1rem;
  }
  
  .tags-stats {
    gap: 2rem;
  }
  
  .stat-number {
    font-size: 1.5rem;
  }
  
  .tag-cloud {
    gap: 0.75rem;
  }
  
  .tag-link {
    padding: 0.6rem 1.2rem;
    font-size: 0.9rem;
  }
  
  .tag-large {
    font-size: 1rem;
    padding: 0.7rem 1.5rem;
  }
  
  .tag-medium {
    font-size: 0.9rem;
    padding: 0.6rem 1.3rem;
  }
  
  .tag-small {
    font-size: 0.8rem;
    padding: 0.5rem 1.1rem;
  }
}
</style>`

  writeFileSync(tagsIndexPath, content)
  console.log('Tags index updated successfully!')
}

// Run the script
const { posts } = generateBlogIndex()
updateBlogIndex()
generateTagsIndex()
generateTagPages(posts)
