import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..', 'dist')
const port = Number(process.env.PORT || 4173)
const host = '127.0.0.1'

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

const server = http.createServer((req, res) => {
  let safeUrl
  try {
    safeUrl = decodeURI(req.url?.split('?')[0] || '/')
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain' })
    res.end('Bad Request')
    return
  }
  let filePath = path.resolve(rootDir, '.' + (safeUrl === '/' ? '/index.html' : safeUrl))

  if (filePath !== rootDir && !filePath.startsWith(rootDir + path.sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' })
    res.end('Forbidden')
    return
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html')
  }

  if (!fs.existsSync(filePath)) {
    // Fallback to index.html for SPA client-side routing
    filePath = path.join(rootDir, 'index.html')
  }

  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Not Found')
    return
  }

  const ext = path.extname(filePath).toLowerCase()
  const contentType = mimeTypes[ext] || 'application/octet-stream'

  res.writeHead(200, {
    'Content-Type': contentType,
    'Cache-Control': 'no-cache',
  })
  fs.createReadStream(filePath).pipe(res)
})

server.listen(port, host, () => {
  console.log(`Le Grand Audit preview server running at http://${host}:${port}/`)
})
