import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const token = process.env.GITHUB_TOKEN
  const owner = process.env.GITHUB_OWNER || 'Julioamancio'
  const repo = process.env.GITHUB_REPO || 'alcaponeburger'
  const branch = process.env.GITHUB_BRANCH || 'main'
  if (!token) return res.status(500).json({ error: 'Missing GITHUB_TOKEN env on Vercel' })

  const products = req.body?.products
  if (!Array.isArray(products)) return res.status(400).json({ error: 'Invalid products payload' })

  try {
    const path = 'public/products.json'
    const getResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' }
    })
    const getData = await getResp.json()
    const sha = getData?.sha

    const content = Buffer.from(JSON.stringify(products, null, 2)).toString('base64')
    const resp = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
      body: JSON.stringify({
        message: 'chore(data): update products.json from Admin UI',
        content,
        sha,
        branch
      })
    })
    if (!resp.ok) {
      const err = await resp.text()
      return res.status(500).json({ error: 'GitHub update failed', detail: err })
    }
    return res.status(200).json({ ok: true })
  } catch (e: any) {
    return res.status(500).json({ error: 'Server exception', detail: String(e?.message || e) })
  }
}
