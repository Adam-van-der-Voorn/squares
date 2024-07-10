export function getPxValue(style: CSSStyleDeclaration, key: string) {
    const p = style.getPropertyValue(key)
    return parseInt(p)
}