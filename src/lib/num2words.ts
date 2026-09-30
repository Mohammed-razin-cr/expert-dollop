// Indian-system rupees in words, e.g. 11800 -> "Eleven Thousand Eight Hundred"
export function rupeesInWords(value: number): string {
  let num = Math.round(Number(value) || 0)
  if (num === 0) return 'Zero'
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
  const two = (n: number): string => (n < 20 ? a[n] : b[Math.floor(n / 10)] + (n % 10 ? ' ' + a[n % 10] : ''))
  const three = (n: number): string => (n >= 100 ? a[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + two(n % 100) : '') : two(n))
  let res = ''
  const crore = Math.floor(num / 10000000); num %= 10000000
  const lakh = Math.floor(num / 100000); num %= 100000
  const thousand = Math.floor(num / 1000); num %= 1000
  if (crore) res += three(crore) + ' Crore '
  if (lakh) res += two(lakh) + ' Lakh '
  if (thousand) res += two(thousand) + ' Thousand '
  if (num) res += three(num)
  return res.trim()
}
