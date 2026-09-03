import assert from 'node:assert/strict';
import test from 'node:test';
import { computeDerivedValues, evaluateParameterFlag } from './rangeEvaluator';
import { TestParameter } from './types';

test('does not classify NON-REACTIVE as reactive', () => {
  assert.equal(evaluateParameterFlag('Non-Reactive (Negative)'), 'NORMAL');
  assert.equal(
    evaluateParameterFlag('Reactive (Positive)', undefined, undefined, undefined, undefined, [
      'Non-Reactive (Negative)',
      'Reactive (Positive)',
    ]),
    'CRITICAL_HIGH',
  );
});

test('distinguishes pending, invalid, and valid numeric results', () => {
  assert.equal(evaluateParameterFlag('', 1, 2), 'PENDING');
  assert.equal(evaluateParameterFlag('12abc', 1, 2), 'INVALID');
  assert.equal(evaluateParameterFlag('1.5', 1, 2), 'NORMAL');
  assert.equal(evaluateParameterFlag('0.5', 1, 2), 'LOW');
});

test('validates controlled qualitative options', () => {
  const options = ['Clear', 'Hazy', 'Turbid'];
  assert.equal(evaluateParameterFlag('Clear', undefined, undefined, undefined, undefined, options), 'NORMAL');
  assert.equal(evaluateParameterFlag('Hazy', undefined, undefined, undefined, undefined, options), 'HIGH');
  assert.equal(evaluateParameterFlag('Unknown', undefined, undefined, undefined, undefined, options), 'INVALID');
});

test('resolves derived values through dependencies regardless of parameter order', () => {
  const parameters: TestParameter[] = [
    { id: 'ag_ratio', name: 'A:G Ratio', value: '', unit: '', refRange: '1.1 - 2.2', minVal: 1.1, maxVal: 2.2, isCalculated: true },
    { id: 'globulin', name: 'Globulin', value: '', unit: 'g/dL', refRange: '2.0 - 3.5', minVal: 2, maxVal: 3.5, isCalculated: true },
    { id: 'albumin', name: 'Albumin', value: '4.0', unit: 'g/dL', refRange: '3.5 - 5.2', minVal: 3.5, maxVal: 5.2 },
    { id: 'tot_protein', name: 'Total Protein', value: '7.0', unit: 'g/dL', refRange: '6.4 - 8.3', minVal: 6.4, maxVal: 8.3 },
  ];

  const result = computeDerivedValues(parameters);
  assert.equal(result[0].value, '1.33');
  assert.equal(result[0].flag, 'NORMAL');
  assert.equal(result[1].value, '3.00');
});
