---
title: All Tags
description: Browse all blog posts by tags
---

<div class="tags-header">
  <h1>All Tags</h1>
  <p>Browse blog posts by tags to find content that interests you. Click on any tag to see related posts.</p>
  <div class="tags-stats">
    <div class="stat-item">
      <span class="stat-number">17</span>
      <span class="stat-label">Total Tags</span>
    </div>
    <div class="stat-item">
      <span class="stat-number">6</span>
      <span class="stat-label">Blog Posts</span>
    </div>
  </div>
</div>

<div class="tags-container">
  <div class="tag-cloud">
    <a href="/blog/tags/features" class="tag-link tag-small">features</a>
    <a href="/blog/tags/update" class="tag-link tag-small">update</a>
    <a href="/blog/tags/performance" class="tag-link tag-small">performance</a>
    <a href="/blog/tags/test" class="tag-link tag-small">test</a>
    <a href="/blog/tags/announcement" class="tag-link tag-small">announcement</a>
    <a href="/blog/tags/release" class="tag-link tag-small">release</a>
    <a href="/blog/tags/framework" class="tag-link tag-small">framework</a>
    <a href="/blog/tags/ai" class="tag-link tag-small">ai</a>
    <a href="/blog/tags/future" class="tag-link tag-small">future</a>
    <a href="/blog/tags/ui-generation" class="tag-link tag-small">ui-generation</a>
    <a href="/blog/tags/innovation" class="tag-link tag-small">innovation</a>
    <a href="/blog/tags/philosophy" class="tag-link tag-small">philosophy</a>
    <a href="/blog/tags/methodology" class="tag-link tag-small">methodology</a>
    <a href="/blog/tags/css" class="tag-link tag-small">css</a>
    <a href="/blog/tags/tutorial" class="tag-link tag-small">tutorial</a>
    <a href="/blog/tags/setup" class="tag-link tag-small">setup</a>
    <a href="/blog/tags/beginner" class="tag-link tag-small">beginner</a>
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
</style>