/**
 * Orthogonal routing for flow-editor arrows.
 *
 * Given two rectangular nodes and their dot (edge-midpoint) IDs,
 * computes an orthogonal (right-angle) SVG path with up to 3
 * adjustable handles for fine-tuning.
 *
 * Direction conventions (matched from temp/orthogonal-all-dirs.html):
 *   bottom-top  : A.bottom → B.top    (flow upward)
 *   top-bottom  : A.top    → B.bottom (flow downward)
 *   right-left  : A.right  → B.left   (flow leftward)
 *   left-right  : A.left   → B.right  (flow rightward)
 *
 * Returns: { d, handles, segs, mode }
 */

const EXT = 30 // extension past node edge before turning

function edgeCenter(bounds, dotId) {
  switch (dotId) {
    case 'top':    return { x: bounds.x + bounds.w / 2, y: bounds.y }
    case 'bottom': return { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h }
    case 'left':   return { x: bounds.x,                y: bounds.y + bounds.h / 2 }
    case 'right':  return { x: bounds.x + bounds.w,     y: bounds.y + bounds.h / 2 }
    default:       return { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 }
  }
}

function getDirType(sDot, tDot) {
  if (sDot === 'bottom' && tDot === 'top')    return 'bottom-top'
  if (sDot === 'top'    && tDot === 'bottom') return 'top-bottom'
  if (sDot === 'right'  && tDot === 'left')   return 'right-left'
  if (sDot === 'left'   && tDot === 'right')  return 'left-right'
  if (sDot === 'top'    && tDot === 'top')    return 'top-top'
  if (sDot === 'bottom' && tDot === 'bottom') return 'bottom-bottom'
  if (sDot === 'left'   && tDot === 'left')   return 'left-left'
  if (sDot === 'right'  && tDot === 'right')  return 'right-right'
  // Cross-direction
  if (sDot === 'top'    && tDot === 'left')   return 'top-left'
  if (sDot === 'top'    && tDot === 'right')  return 'top-right'
  if (sDot === 'bottom' && tDot === 'left')   return 'bottom-left'
  if (sDot === 'bottom' && tDot === 'right')  return 'bottom-right'
  if (sDot === 'left'   && tDot === 'top')    return 'left-top'
  if (sDot === 'left'   && tDot === 'bottom') return 'left-bottom'
  if (sDot === 'right'  && tDot === 'top')    return 'right-top'
  if (sDot === 'right'  && tDot === 'bottom') return 'right-bottom'
  return null
}

// ---- Direction descriptors ----
const DIR = {
  'bottom-top': {
    aheadAxis:  'y',
    aheadSign:  1,        // target y >= source y → ahead
    alignAxis:  'x',
    aheadKey:   'y',
    behindSide: 'below',  // extension goes below A
    extPerp(a, b) { return { x: a.x, y: a.y + EXT } },          // point below aDot
    lowExt(a)  { return a.y + EXT },
    highExt(b, a) { return Math.min(b.y - EXT, a.y + a.h + EXT) },
    pathSegments(aX, aY, bX, bY, cl, ch, vertPos) {
      return [
        { x: aX, y: aY }, { x: aX, y: cl },
        { x: vertPos, y: cl }, { x: vertPos, y: ch },
        { x: bX, y: ch }, { x: bX, y: bY },
      ]
    },
    simpleMid(aX, aY, bX, bY, off) {
      const midY = (aY + bY) / 2 + off
      const clamp = Math.max(aY + 4, Math.min(bY - 4, midY))
      return { d: `M ${aX} ${aY} L ${aX} ${clamp} L ${bX} ${clamp} L ${bX} ${bY}`, midX: (aX + bX) / 2, midY: clamp }
    },
  },
  'top-bottom': {
    aheadAxis: 'y',
    aheadSign: -1,       // target y <= source y → ahead
    alignAxis: 'x',
    aheadKey: 'y',
    behindSide: 'above',
    extPerp(a, b) { return { x: a.x, y: a.y - EXT } },
    lowExt(a)  { return a.y - EXT },
    highExt(b, a) { return Math.max(b.y + EXT, a.y + a.h + EXT) },
    pathSegments(aX, aY, bX, bY, cl, ch, vertPos) {
      return [
        { x: aX, y: aY }, { x: aX, y: cl },
        { x: vertPos, y: cl }, { x: vertPos, y: ch },
        { x: bX, y: ch }, { x: bX, y: bY },
      ]
    },
    simpleMid(aX, aY, bX, bY, off) {
      const midY = (aY + bY) / 2 + off
      const clamp = Math.max(bY + 4, Math.min(aY - 4, midY))
      return { d: `M ${aX} ${aY} L ${aX} ${clamp} L ${bX} ${clamp} L ${bX} ${bY}`, midX: (aX + bX) / 2, midY: clamp }
    },
  },
  'right-left': {
    aheadAxis: 'x',
    aheadSign: 1,        // target x >= source x → ahead
    alignAxis: 'y',
    aheadKey: 'x',
    behindSide: 'right',
    extPerp(a, b) { return { x: a.x + EXT, y: a.y } },
    lowExt(a)  { return a.x + EXT },
    highExt(b, a) { return Math.min(b.x - EXT, a.x - EXT) },
    pathSegments(aX, aY, bX, bY, cl, ch, vertPos) {
      return [
        { x: aX, y: aY }, { x: cl, y: aY },
        { x: cl, y: vertPos }, { x: ch, y: vertPos },
        { x: ch, y: bY }, { x: bX, y: bY },
      ]
    },
    simpleMid(aX, aY, bX, bY, off) {
      const midX = (aX + bX) / 2 + off
      const clamp = Math.min(aX - 4, Math.max(bX + 4, midX))
      return { d: `M ${aX} ${aY} L ${clamp} ${aY} L ${clamp} ${bY} L ${bX} ${bY}`, midX: clamp, midY: (aY + bY) / 2 }
    },
  },
  'left-right': {
    aheadAxis: 'x',
    aheadSign: -1,
    alignAxis: 'y',
    aheadKey: 'x',
    behindSide: 'left',
    extPerp(a, b) { return { x: a.x - EXT, y: a.y } },
    lowExt(a)  { return a.x - EXT },
    highExt(b, a) { return Math.max(b.x + EXT, a.x + a.w + EXT) },
    pathSegments(aX, aY, bX, bY, cl, ch, vertPos) {
      return [
        { x: aX, y: aY }, { x: cl, y: aY },
        { x: cl, y: vertPos }, { x: ch, y: vertPos },
        { x: ch, y: bY }, { x: bX, y: bY },
      ]
    },
    simpleMid(aX, aY, bX, bY, off) {
      const midX = (aX + bX) / 2 + off
      const clamp = Math.max(bX + 4, Math.min(aX - 4, midX))
      return { d: `M ${aX} ${aY} L ${clamp} ${aY} L ${clamp} ${bY} L ${bX} ${bY}`, midX: clamp, midY: (aY + bY) / 2 }
    },
  },
}

/**
 * Check if two ranges overlap.
 */
function rangesOverlap(a1, a2, b1, b2) {
  return !(a2 < b1 || b2 < a1)
}

/**
 * Route for same-side connections (top-top, bottom-bottom, left-left, right-right).
 */
function routeSameSide(dirType, aDot, bDot, sBounds, tBounds, h2, h3, h4) {
  const EXT = 30, G = 25
  const aX = aDot.x, aY = aDot.y, bX = bDot.x, bY = bDot.y

  // Common: determine if overlap on the perpendicular axis
  const overlapX = rangesOverlap(sBounds.x, sBounds.x + sBounds.w, tBounds.x, tBounds.x + tBounds.w)
  const overlapY = rangesOverlap(sBounds.y, sBounds.y + sBounds.h, tBounds.y, tBounds.y + tBounds.h)
  const isVertical = dirType === 'top-top' || dirType === 'bottom-bottom'

  // 3 segments: no overlap on perpendicular axis
  if ((isVertical && !overlapX) || (!isVertical && !overlapY)) {
    let d, hx, hy
    if (dirType === 'top-top') {
      const topY = Math.min(aY, bY) - EXT + h2
      const clamp = Math.min(aY - 4, bY - 4, topY)
      d = `M ${aX} ${aY} L ${aX} ${clamp} L ${bX} ${clamp} L ${bX} ${bY}`
      hx = (aX + bX) / 2; hy = clamp
    } else if (dirType === 'bottom-bottom') {
      const botY = Math.max(aY, bY) + EXT + h2
      const clamp = Math.max(aY + 4, bY + 4, botY)
      d = `M ${aX} ${aY} L ${aX} ${clamp} L ${bX} ${clamp} L ${bX} ${bY}`
      hx = (aX + bX) / 2; hy = clamp
    } else if (dirType === 'left-left') {
      const leftX = Math.min(aX, bX) - EXT + h2
      const clamp = Math.min(aX - 4, bX - 4, leftX)
      d = `M ${aX} ${aY} L ${clamp} ${aY} L ${clamp} ${bY} L ${bX} ${bY}`
      hx = clamp; hy = (aY + bY) / 2
    } else { // right-right
      const rightX = Math.max(aX, bX) + EXT + h2
      const clamp = Math.max(aX + 4, bX + 4, rightX)
      d = `M ${aX} ${aY} L ${clamp} ${aY} L ${clamp} ${bY} L ${bX} ${bY}`
      hx = clamp; hy = (aY + bY) / 2
    }
    return {
      d,
      handles: [{ type: isVertical ? 'h' : 'v', x: hx, y: hy, offKey: 'h2' }],
      segs: 3, mode: '3段 敞口型',
      pts: dirType === 'top-top' || dirType === 'bottom-bottom'
        ? [{ x: aX, y: aY }, { x: aX, y: hy }, { x: bX, y: hy }, { x: bX, y: bY }]
        : [{ x: aX, y: aY }, { x: hx, y: aY }, { x: hx, y: bY }, { x: bX, y: bY }],
    }
  }

  // 5 segments: overlap on perpendicular axis
  // Determine bypass side
  const bMidX = tBounds.x + tBounds.w / 2
  const bMidY = tBounds.y + tBounds.h / 2
  const aR = sBounds.x + sBounds.w, bR = tBounds.x + tBounds.w
  const aL = sBounds.x, bL = tBounds.x
  const aB = sBounds.y + sBounds.h, bB = tBounds.y + tBounds.h
  const aT = sBounds.y, bT = tBounds.y

  let vertPos
  if (isVertical) {
    const side = bMidX >= aX ? 1 : -1
    vertPos = side > 0 ? Math.max(aR, bR) + G + h3 : Math.min(aL, bL) - G + h3
  } else {
    const side = bMidY >= aY ? 1 : -1
    vertPos = side > 0 ? Math.max(aB, bB) + G + h3 : Math.min(aT, bT) - G + h3
  }

  let pts
  if (dirType === 'top-top') {
    if (bY >= aY) {
      // B below A
      const cl = aY - EXT + h2
      const ch = (aB + bY) / 2 + h4
      pts = [
        { x: aX, y: aY }, { x: aX, y: cl },
        { x: vertPos, y: cl }, { x: vertPos, y: ch },
        { x: bX, y: ch }, { x: bX, y: bY },
      ]
    } else {
      const cl = (bB + aY) / 2 + h2
      const ch = bY - EXT + h4
      pts = [
        { x: aX, y: aY }, { x: aX, y: cl },
        { x: vertPos, y: cl }, { x: vertPos, y: ch },
        { x: bX, y: ch }, { x: bX, y: bY },
      ]
    }
  } else if (dirType === 'bottom-bottom') {
    if (bY < aY) {
      // B above A
      const cl = aY + EXT + h2
      const ch = (aT + bB) / 2 + h4
      pts = [
        { x: aX, y: aY }, { x: aX, y: cl },
        { x: vertPos, y: cl }, { x: vertPos, y: ch },
        { x: bX, y: ch }, { x: bX, y: bY },
      ]
    } else {
      const cl = (aT + bB) / 2 + h2
      const ch = bY + EXT + h4
      pts = [
        { x: aX, y: aY }, { x: aX, y: cl },
        { x: vertPos, y: cl }, { x: vertPos, y: ch },
        { x: bX, y: ch }, { x: bX, y: bY },
      ]
    }
  } else if (dirType === 'left-left') {
    if (bX >= aX) {
      // B right of A
      const cl = aX - EXT + h2
      const ch = (aL + bR) / 2 + h4
      pts = [
        { x: aX, y: aY }, { x: cl, y: aY },
        { x: cl, y: vertPos }, { x: ch, y: vertPos },
        { x: ch, y: bY }, { x: bX, y: bY },
      ]
    } else {
      const cl = (aR + bL) / 2 + h2
      const ch = bX - EXT + h4
      pts = [
        { x: aX, y: aY }, { x: cl, y: aY },
        { x: cl, y: vertPos }, { x: ch, y: vertPos },
        { x: ch, y: bY }, { x: bX, y: bY },
      ]
    }
  } else { // right-right
    if (bX < aX) {
      // B left of A
      const cl = aX + EXT + h2
      const ch = (aR + bL) / 2 + h4
      pts = [
        { x: aX, y: aY }, { x: cl, y: aY },
        { x: cl, y: vertPos }, { x: ch, y: vertPos },
        { x: ch, y: bY }, { x: bX, y: bY },
      ]
    } else {
      const cl = (aL + bR) / 2 + h2
      const ch = bX + EXT + h4
      pts = [
        { x: aX, y: aY }, { x: cl, y: aY },
        { x: cl, y: vertPos }, { x: ch, y: vertPos },
        { x: ch, y: bY }, { x: bX, y: bY },
      ]
    }
  }

  // Build handles (skip first and last segment)
  const handles = []
  const segKeys = ['h2', 'h3', 'h4']
  for (let i = 1; i < pts.length - 2; i++) {
    const p1 = pts[i], p2 = pts[i + 1]
    const len = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2)
    if (len > 5) {
      const isH = Math.abs(p2.y - p1.y) < Math.abs(p2.x - p1.x)
      handles.push({
        type: isH ? 'h' : 'v',
        x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2,
        offKey: handles.length < segKeys.length ? segKeys[handles.length] : `h${handles.length + 2}`,
      })
    }
  }

  const d = pts.map((p, i) => (i === 0 ? 'M' : 'L') + ` ${p.x} ${p.y}`).join(' ')
  return { d, handles, segs: 5, mode: '5段 同侧U型', pts }
}

/**
 * Cross-direction routing (perpendicular axes).
 * e.g. A.top → B.left, A.left → B.top, etc.
 * Always 4 segments (5 points) or 2 segments (degenerate).
 */
function routeCrossDir(sBounds, tBounds, sDot, tDot, h2, h3, h4) {
  const EXT = 30, MIN_2SEG = 10

  const aDot = edgeCenter(sBounds, sDot)
  const bDot = edgeCenter(tBounds, tDot)
  const aX = aDot.x, aY = aDot.y, bX = bDot.x, bY = bDot.y

  const aL = sBounds.x, aR = sBounds.x + sBounds.w, aT = sBounds.y, aBtm = sBounds.y + sBounds.h
  const bL = tBounds.x, bR = tBounds.x + tBounds.w, bT = tBounds.y, bBtm = tBounds.y + tBounds.h

  const isSrcVert = sDot === 'top' || sDot === 'bottom'
  const emitUp = sDot === 'top', emitDown = sDot === 'bottom'
  const emitLeft = sDot === 'left', emitRight = sDot === 'right'
  const tgtLeft = tDot === 'left', tgtRight = tDot === 'right'
  const tgtTop = tDot === 'top', tgtBottom = tDot === 'bottom'

  // ---- 2-segment degenerate ----
  let isDeg2 = false, deg2Pts = null
  if (emitUp && tgtLeft  && aX < bX) { const s1 = Math.abs(aY-bY), s2 = Math.abs(aX-bX); if (bY < aY && s1 > MIN_2SEG && s2 > MIN_2SEG) { isDeg2 = true; deg2Pts = [{x:aX,y:aY},{x:aX,y:bY},{x:bX,y:bY}] } }
  else if (emitUp && tgtRight && aX > bX) { const s1 = Math.abs(aY-bY), s2 = Math.abs(aX-bX); if (bY < aY && s1 > MIN_2SEG && s2 > MIN_2SEG) { isDeg2 = true; deg2Pts = [{x:aX,y:aY},{x:aX,y:bY},{x:bX,y:bY}] } }
  else if (emitDown && tgtLeft  && aX < bX) { const s1 = Math.abs(aY-bY), s2 = Math.abs(aX-bX); if (bY > aY && s1 > MIN_2SEG && s2 > MIN_2SEG) { isDeg2 = true; deg2Pts = [{x:aX,y:aY},{x:aX,y:bY},{x:bX,y:bY}] } }
  else if (emitDown && tgtRight && aX > bX) { const s1 = Math.abs(aY-bY), s2 = Math.abs(aX-bX); if (bY > aY && s1 > MIN_2SEG && s2 > MIN_2SEG) { isDeg2 = true; deg2Pts = [{x:aX,y:aY},{x:aX,y:bY},{x:bX,y:bY}] } }
  else if (emitLeft && tgtTop    && aY < bY) { const s1 = Math.abs(aX-bX), s2 = Math.abs(aY-bY); if (bX < aX && s1 > MIN_2SEG && s2 > MIN_2SEG) { isDeg2 = true; deg2Pts = [{x:aX,y:aY},{x:bX,y:aY},{x:bX,y:bY}] } }
  else if (emitLeft && tgtBottom && aY > bY) { const s1 = Math.abs(aX-bX), s2 = Math.abs(aY-bY); if (bX < aX && s1 > MIN_2SEG && s2 > MIN_2SEG) { isDeg2 = true; deg2Pts = [{x:aX,y:aY},{x:bX,y:aY},{x:bX,y:bY}] } }
  else if (emitRight && tgtTop    && aY < bY) { const s1 = Math.abs(aX-bX), s2 = Math.abs(aY-bY); if (bX > aX && s1 > MIN_2SEG && s2 > MIN_2SEG) { isDeg2 = true; deg2Pts = [{x:aX,y:aY},{x:bX,y:aY},{x:bX,y:bY}] } }
  else if (emitRight && tgtBottom && aY > bY) { const s1 = Math.abs(aX-bX), s2 = Math.abs(aY-bY); if (bX > aX && s1 > MIN_2SEG && s2 > MIN_2SEG) { isDeg2 = true; deg2Pts = [{x:aX,y:aY},{x:bX,y:aY},{x:bX,y:bY}] } }

  if (isDeg2) {
    const d = deg2Pts.map((p,i)=>(i===0?'M':'L')+` ${p.x} ${p.y}`).join(' ')
    return { d, segs: 2, mode: '2段 直连', pts: deg2Pts, handles: [] }
  }

  // ---- 4-segment routing ----
  let pt2_x, pt2_y, pt3_x, pt3_y

  if (isSrcVert) {
    if (emitUp) {
      if (bBtm <= aT) pt2_y = (aT + bBtm) / 2 + h2
      else pt2_y = Math.min(aT, bT) - EXT + h2
      if (pt2_y > aT - 4) pt2_y = aT - 4
    } else {
      if (bT >= aBtm) pt2_y = (aBtm + bT) / 2 + h2
      else pt2_y = Math.max(aBtm, bBtm) + EXT + h2
      if (pt2_y < aBtm + 4) pt2_y = aBtm + 4
    }
    if (tgtLeft) {
      if (bL > aR) pt3_x = (aR + bL) / 2 + h3
      else pt3_x = Math.min(aL, bL) - EXT + h3
      if (pt3_x >= bL) pt3_x = bL - EXT
    } else {
      if (bR < aL) pt3_x = (aL + bR) / 2 + h3
      else pt3_x = Math.max(aR, bR) + EXT + h3
      if (pt3_x <= bR) pt3_x = bR + EXT
    }
  } else {
    if (emitLeft) {
      if (bR <= aL) pt2_x = (aL + bR) / 2 + h2
      else pt2_x = Math.min(aL, bL) - EXT + h2
      if (pt2_x >= aL) pt2_x = aL - EXT
    } else {
      if (bL >= aR) pt2_x = (aR + bL) / 2 + h2
      else pt2_x = Math.max(aR, bR) + EXT + h2
      if (pt2_x <= aR) pt2_x = aR + EXT
    }
    if (tgtTop) {
      if (bT > aBtm) {
        pt3_y = (aBtm + bT) / 2 + h3
        if (pt3_y <= aBtm) pt3_y = aBtm + EXT
        if (pt3_y >= bT) pt3_y = bT - EXT
      } else {
        pt3_y = Math.min(aT, bT) - EXT + h3
        if (pt3_y >= bT) pt3_y = bT - EXT
      }
    } else {
      if (bBtm < aT) {
        pt3_y = (aT + bBtm) / 2 + h3
        if (pt3_y >= aT) pt3_y = aT - EXT
        if (pt3_y <= bBtm) pt3_y = bBtm + EXT
      } else {
        pt3_y = Math.max(aBtm, bBtm) + EXT + h3
        if (pt3_y <= bBtm) pt3_y = bBtm + EXT
      }
    }
  }

  const pt2 = isSrcVert ? { x: aX, y: pt2_y } : { x: pt2_x, y: aY }
  const pt3 = isSrcVert ? { x: pt3_x, y: bY } : { x: bX, y: pt3_y }

  const pts = [
    { x: aX, y: aY },
    { x: pt2.x, y: pt2.y },
    isSrcVert ? { x: pt3.x, y: pt2.y } : { x: pt2.x, y: pt3.y },
    { x: pt3.x, y: pt3.y },
    { x: bX, y: bY },
  ]

  const d = pts.map((p, i) => (i === 0 ? 'M' : 'L') + ` ${p.x} ${p.y}`).join(' ')

  const handles = []
  const seg2len = isSrcVert ? Math.abs(pts[2].x - pts[1].x) : Math.abs(pts[2].y - pts[1].y)
  if (seg2len > 5) {
    handles.push({ type: isSrcVert ? 'h' : 'v', x: (pts[1].x + pts[2].x) / 2, y: (pts[1].y + pts[2].y) / 2, offKey: 'h2' })
  }
  const seg3len = isSrcVert ? Math.abs(pts[3].y - pts[2].y) : Math.abs(pts[3].x - pts[2].x)
  if (seg3len > 5) {
    handles.push({ type: isSrcVert ? 'v' : 'h', x: (pts[2].x + pts[3].x) / 2, y: (pts[2].y + pts[3].y) / 2, offKey: 'h3' })
  }

  let segCount = 0
  for (let i = 0; i < pts.length - 1; i++) {
    const dx = Math.abs(pts[i + 1].x - pts[i].x), dy = Math.abs(pts[i + 1].y - pts[i].y)
    if (dx > 2 || dy > 2) segCount++
  }

  return { d, handles, segs: segCount, mode: segCount === 2 ? '2段 对角' : '4段 对角', pts }
}

/**
 * Compute an orthogonal path between two dots on two rectangular nodes.
 *
 * @param {Object} sBounds - Source node page bounds {x,y,w,h}
 * @param {Object} tBounds - Target node page bounds {x,y,w,h}
 * @param {string} sDot    - Source dot ID ('top'|'bottom'|'left'|'right')
 * @param {string} tDot    - Target dot ID
 * @param {Object} [off]   - Offsets {h2, h3, h4} (defaults to zeros)
 * @returns {{ d: string, handles: Array<{type:string,x:number,y:number,offKey:string}>, segs:number, mode:string, pts:Array }}
 */
export function orthogonalRoute(sBounds, tBounds, sDot, tDot, off = {}) {
  const h2 = off.h2 ?? 0
  const h3 = off.h3 ?? 0
  const h4 = off.h4 ?? 0

  const aDot = edgeCenter(sBounds, sDot)
  const bDot = edgeCenter(tBounds, tDot)
  const aX = aDot.x, aY = aDot.y
  const bX = bDot.x, bY = bDot.y

  const dirType = getDirType(sDot, tDot)

  // Same-side routing (top-top, bottom-bottom, left-left, right-right)
  if (dirType === 'top-top' || dirType === 'bottom-bottom' || dirType === 'left-left' || dirType === 'right-right') {
    return routeSameSide(dirType, aDot, bDot, sBounds, tBounds, h2, h3, h4)
  }

  // Cross-direction routing
  const crossDirs = ['top-left','top-right','bottom-left','bottom-right','left-top','left-bottom','right-top','right-bottom']
  if (crossDirs.includes(dirType)) {
    return routeCrossDir(sBounds, tBounds, sDot, tDot, h2, h3, h4)
  }

  const dir = DIR[dirType]

  // Determine ahead/behind
  const aVal = aDot[dir.aheadKey]
  const bVal = bDot[dir.aheadKey]
  const isAhead = dir.aheadSign > 0 ? bVal >= aVal - 5 : bVal <= aVal + 5

  // Alignment check
  const aAl = aDot[dir.alignAxis]
  const bAl = bDot[dir.alignAxis]
  const isAligned = Math.abs(aAl - bAl) < 5

  // ---- 1 segment: straight line ----
  if (isAhead && isAligned) {
    return {
      d: `M ${aX} ${aY} L ${bX} ${bY}`,
      handles: [],
      segs: 1,
      mode: '1段 直连',
      pts: [{ x: aX, y: aY }, { x: bX, y: bY }],
    }
  }

  // ---- 3 segments: ahead but not aligned ----
  if (isAhead) {
    const { d, midX, midY } = dir.simpleMid(aX, aY, bX, bY, h2)
    const handleType = (dirType === 'bottom-top' || dirType === 'top-bottom') ? 'h' : 'v'
    return {
      d,
      handles: [{ type: handleType, x: midX, y: midY, offKey: 'h2' }],
      segs: 3,
      mode: '3段 L型',
      pts: [
        { x: aX, y: aY },
        { x: dirType === 'bottom-top' || dirType === 'top-bottom' ? aX : midX, y: dirType === 'bottom-top' || dirType === 'top-bottom' ? midY : aY },
        { x: dirType === 'bottom-top' || dirType === 'top-bottom' ? bX : midX, y: dirType === 'bottom-top' || dirType === 'top-bottom' ? midY : bY },
        { x: bX, y: bY },
      ],
    }
  }

  // ---- 5 segments: behind ----
  const isOverlap = (dirType === 'bottom-top' || dirType === 'top-bottom')
    ? rangesOverlap(sBounds.x, sBounds.x + sBounds.w, tBounds.x, tBounds.x + tBounds.w)
    : rangesOverlap(sBounds.y, sBounds.y + sBounds.h, tBounds.y, tBounds.y + tBounds.h)

  const G = 25
  let vertPos
  if (dirType === 'bottom-top' || dirType === 'top-bottom') {
    const bMidX = tBounds.x + tBounds.w / 2
    if (isOverlap) {
      vertPos = (bMidX >= aX)
        ? Math.max(sBounds.x + sBounds.w, tBounds.x + tBounds.w) + G + h3
        : Math.min(sBounds.x, tBounds.x) - G + h3
    } else {
      vertPos = (Math.min(sBounds.x + sBounds.w, tBounds.x + tBounds.w) + Math.max(sBounds.x, tBounds.x)) / 2 + h3
    }
  } else {
    const bMidY = tBounds.y + tBounds.h / 2
    if (isOverlap) {
      vertPos = (bMidY >= aY)
        ? Math.max(sBounds.y + sBounds.h, tBounds.y + tBounds.h) + G + h3
        : Math.min(sBounds.y, tBounds.y) - G + h3
    } else {
      vertPos = (Math.min(sBounds.y + sBounds.h, tBounds.y + tBounds.h) + Math.max(sBounds.y, tBounds.y)) / 2 + h3
    }
  }

  const cl = dir.lowExt(aDot) + h2
  const ch = dir.highExt(bDot, sBounds) + h4

  // Clamp: cl must stay away from node, ch must be on the other side of cl
  let clClamped, chClamped
  if (dirType === 'bottom-top') {
    clClamped = Math.max(aY + 4, cl)
    chClamped = Math.min(ch, clClamped - 10)
  } else if (dirType === 'top-bottom') {
    clClamped = Math.min(aY - 4, cl)
    chClamped = Math.max(ch, clClamped + 10)
  } else if (dirType === 'right-left') {
    clClamped = Math.max(aX + 4, cl)
    chClamped = Math.min(ch, clClamped - 10)
  } else {
    clClamped = Math.min(aX - 4, cl)
    chClamped = Math.max(ch, clClamped + 10)
  }

  const pts = dir.pathSegments(aX, aY, bX, bY, clClamped, chClamped, vertPos)

  // Build SVG path
  let parts = [`M ${pts[0].x} ${pts[0].y}`]
  for (let i = 1; i < pts.length; i++) {
    parts.push(`L ${pts[i].x} ${pts[i].y}`)
  }
  const d = parts.join(' ')

  // Build handles — only on middle segments (skip first and last connecting segments)
  const handles = []
  const MIN_SEG = 5
  const segTypeKeys = ['h2', 'h3', 'h4']
  let handleIdx = 0
  for (let i = 0; i < pts.length - 1; i++) {
    // Skip first segment (from node) and last segment (to node)
    if (i === 0 || i === pts.length - 2) continue
    const p1 = pts[i], p2 = pts[i + 1]
    const len = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2)
    if (len > MIN_SEG) {
      // Handle type matches segment orientation: horizontal seg → horizontal capsule (type 'h')
      //              vertical seg → vertical capsule (type 'v')
      const isHorizontal = Math.abs(p2.y - p1.y) < Math.abs(p2.x - p1.x)
      handles.push({
        type: isHorizontal ? 'h' : 'v',
        x: (p1.x + p2.x) / 2,
        y: (p1.y + p2.y) / 2,
        offKey: handleIdx < segTypeKeys.length ? segTypeKeys[handleIdx] : `h${handleIdx + 2}`,
      })
      handleIdx++
    }
  }

  return {
    d,
    handles,
    segs: 5,
    mode: '5段 U型',
    pts,
  }
}
