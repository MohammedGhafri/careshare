// Dev/test only: adapts an embedded PGlite database to the same tagged-template
// calling convention as Neon's `neon()` driver, so server/careApi.js runs unchanged.
export function pgliteSql(db) {
  return (strings, ...values) => {
    const text = strings.reduce((acc, part, i) => `${acc}$${i}${part}`)
    return db.query(text, values).then((r) => r.rows)
  }
}
