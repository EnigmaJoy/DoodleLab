// Proxy that returns the class name key as its value.
// This lets CSS module imports compile in jsdom without PostCSS.
const handler: ProxyHandler<Record<string, string>> = {
  get(_target, prop: string) {
    return prop
  },
}
export default new Proxy({} as Record<string, string>, handler)
