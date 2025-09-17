/* eslint-disable */
import './style.css'
import { initializeDirector, Director } from '@barocss/ui'

class MockAgent {
  public name = 'mock-agent'
  public type = 'mock'
  async initialize() { return true }
  async shutdown() { return true }
  isConnected() { return true }
  async sendRequest(request: any) {
    const html = `
      <div data-scene-root>
        <h1>BaroCSS UI Manager</h1>
        <p>Request: ${request.payload?.message || ''}</p>
        <button data-action-id="next">Next</button>
      </div>`
    return {
      type: 'success',
      id: 'res-1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
      requestId: request.id,
      correlationId: request.metadata?.correlationId,
      data: {
        result: {
          content: html,
          type: 'html',
          metadata: { }
        }
      },
      metadata: { provider: 'mock', agent: 'mock-agent' }
    }
  }
}

async function boot() {
  const root = document.getElementById('app')!
  const director: Director = await initializeDirector({}, new MockAgent() as any)

  // 디버그 로그 구독
  director.subscribeToEvents((e) => {
    console.log('[manager:event]', e.type, e)
  })

  const input = document.getElementById('bc-input') as HTMLInputElement
  const send = document.getElementById('bc-send') as HTMLButtonElement
  const output = document.getElementById('bc-output') as HTMLDivElement
  const messages = document.getElementById('bc-messages') as HTMLDivElement

  function pushMessage(role: 'user' | 'assistant', text: string) {
    const item = document.createElement('div')
    item.textContent = (role === 'user' ? 'You: ' : 'AI: ') + text
    item.style.fontSize = '13px'
    messages.appendChild(item)
    messages.scrollTop = messages.scrollHeight
  }

  async function runQuery(message: string) {
    if (!message) return
    pushMessage('user', message)
    const next = await director.request(message)
    const nextHtml = (next.ui && typeof next.ui.content === 'string') ? next.ui.content : `<pre>${JSON.stringify(next, null, 2)}</pre>`
    output.innerHTML = nextHtml
    pushMessage('assistant', next.title || '응답이 생성되었습니다')
  }

  // 첫 요청
  await runQuery('온라인 쇼핑몰을 만들어줘')

  send.addEventListener('click', async () => {
    await runQuery(input.value)
    input.value = ''
    input.focus()
  })
  input.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      await runQuery(input.value)
      input.value = ''
      input.focus()
    }
  })
}

boot()
