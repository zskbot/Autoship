import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { shellQuote, buildSafeEnv } from '../src/runner/real-executor.mjs'
import { deployTarget } from '../src/runner/target-adapters.mjs'
import { deployStaticArtifact, rollbackStatic } from '../src/runner/static-deploy.mjs'

assert.equal(shellQuote("a'b"), "'a'\\''b'")
const env = buildSafeEnv([{ key: 'PUBLIC_TEST', value: 'ok' }, { key: 'SECRET_TEST', value: 'hidden', isSecret: true }])
assert.equal(env.PUBLIC_TEST, 'ok')
assert.equal(env.SECRET_TEST, 'hidden')
assert.equal(env.GEMINI_API_KEY, undefined)
await assert.rejects(() => deployTarget({ target: 'static-server', deployPath: '/' }, '/tmp/no-workspace', { id: 'x' }), /Unsafe|dist/)
await assert.rejects(() => deployTarget({ target: 'vps-ssh', serverIp: '127.0.0.1' }, '/tmp/no-workspace', { id: 'x' }), /deployPath/)
const root = await fs.mkdtemp(path.join(os.tmpdir(), 'autoship-static-test-'))
const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'autoship-workspace-'))
await fs.mkdir(path.join(workspace, 'dist'), { recursive: true })
await fs.writeFile(path.join(workspace, 'dist', 'index.html'), 'v1')
const current = await deployStaticArtifact(workspace, root)
assert.equal(await fs.readFile(path.join(current, 'index.html'), 'utf8'), 'v1')
await fs.writeFile(path.join(workspace, 'dist', 'index.html'), 'v2')
await deployStaticArtifact(workspace, root)
await rollbackStatic(root)
assert.equal(await fs.readFile(path.join(root, 'current', 'index.html'), 'utf8'), 'v1')
await fs.rm(root, { recursive: true, force: true })
await fs.rm(workspace, { recursive: true, force: true })
console.log('Autoship runner tests passed')
