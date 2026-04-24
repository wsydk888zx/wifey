export function toRoman(num) {
  const numerals = [
    ['M', 1000],
    ['CM', 900],
    ['D', 500],
    ['CD', 400],
    ['C', 100],
    ['XC', 90],
    ['L', 50],
    ['XL', 40],
    ['X', 10],
    ['IX', 9],
    ['V', 5],
    ['IV', 4],
    ['I', 1],
  ];

  let value = Math.max(1, Number(num) || 1);
  let output = '';

  numerals.forEach(([symbol, weight]) => {
    while (value >= weight) {
      output += symbol;
      value -= weight;
    }
  });

  return output;
}
