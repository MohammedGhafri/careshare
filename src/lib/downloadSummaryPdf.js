// Renders a buildWeeklySummary() result (src/lib/weeklySummary.js) to a PDF
// and triggers a browser download. @react-pdf/renderer and the PDF component
// are imported dynamically so the (fairly large) PDF renderer stays out of
// the app's main bundle and is only fetched when someone actually generates
// a summary.

import { createElement } from 'react'

function toFileDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export async function downloadSummaryPdf(summary) {
  const [{ pdf }, { default: WeeklySummaryPdf }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('../components/WeeklySummaryPdf.jsx'),
  ])

  const blob = await pdf(createElement(WeeklySummaryPdf, { summary })).toBlob()

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `careshare-summary-${toFileDate(summary.range.start)}.pdf`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
