import { orthogonalRoute } from '../src/utils/orthogonalRouting.js'

const a = {x:80, y:200, w:180, h:80}

// bt 下方对齐
const r1 = orthogonalRoute(a, {x:80, y:350, w:180, h:80}, 'bottom', 'top')
console.log('bt 下方对齐:', JSON.stringify(r1))

// bt 下方错位
const r2 = orthogonalRoute(a, {x:200, y:350, w:180, h:80}, 'bottom', 'top')
console.log('bt 下方错位:', JSON.stringify(r2))

// bt 同水平 5段
const r3 = orthogonalRoute(a, {x:380, y:200, w:180, h:80}, 'bottom', 'top')
console.log('bt 同水平:', JSON.stringify(r3))

// tb
const r4 = orthogonalRoute({x:80,y:350,w:180,h:80}, a, 'top', 'bottom')
console.log('tb:', JSON.stringify(r4))

// lr
const r5 = orthogonalRoute(a, {x:30,y:200,w:180,h:80}, 'left', 'right')
console.log('lr:', JSON.stringify(r5))

// rl
const r6 = orthogonalRoute(a, {x:380,y:200,w:180,h:80}, 'right', 'left')
console.log('rl:', JSON.stringify(r6))

// non-standard
const r7 = orthogonalRoute(a, {x:380,y:200,w:180,h:80}, 'bottom', 'right')
console.log('非标准:', JSON.stringify(r7))

console.log('✅ DONE')
