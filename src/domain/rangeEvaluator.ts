import { ParameterFlag, TestParameter } from '@/domain/types';

const DERIVED_PARAMETER_IDS = new Set([
  'bili_ind',
  'globulin',
  'ag_ratio',
  'bun',
  'vldl',
  'chol_hdl_ratio',
  'non_hdl',
  'eag',
]);

export function evaluateParameterFlag(
  value: string | number,
  minVal?: number,
  maxVal?: number,
  criticalMin?: number,
  criticalMax?: number,
  options?: string[],
): ParameterFlag {
  const strVal = String(value).trim();
  if (!strVal || strVal === '-' || strVal.toUpperCase() === 'N/A') {
    return 'PENDING';
  }

  const upper = strVal.toUpperCase().replace(/\s+/g, ' ').trim();
  const hasNumericReference =
    minVal !== undefined || maxVal !== undefined || criticalMin !== undefined || criticalMax !== undefined;

  // Controlled qualitative values must come from the configured catalog.
  // The first option is the template's normal result by convention.
  if (options?.length) {
    const selectedOption = options.find((option) => option.trim().toUpperCase() === upper);
    if (!selectedOption) return 'INVALID';
    if (selectedOption.trim().toUpperCase() === options[0].trim().toUpperCase()) {
      return 'NORMAL';
    }
  }

  // Check non-reactive before reactive because NON-REACTIVE contains the
  // substring REACTIVE.
  if (upper.includes('NON-REACTIVE') || upper.includes('NON REACTIVE') || upper.includes('NONREACTIVE')) {
    return 'NORMAL';
  }
  if (upper.includes('NEGATIVE') || upper === 'NIL' || upper.includes('CLEAR') || upper.includes('< 1:80')) {
    return 'NORMAL';
  }
  if (
    upper.includes('POSITIVE') ||
    upper === 'REACTIVE' ||
    upper.includes('PRESENT') ||
    upper.includes('1:160') ||
    upper.includes('1:320') ||
    upper.includes('+++')
  ) {
    return 'CRITICAL_HIGH';
  }
  if (upper.includes('TRACE') || upper.includes('+ (') || upper.includes('HAZY') || upper.includes('TURBID')) {
    return 'HIGH';
  }

  // Strict numeric parsing avoids treating values such as "12abc" as a
  // valid result. Free-text parameters without numeric references are valid.
  const num = Number(strVal.replace(/,/g, ''));
  if (!Number.isFinite(num)) {
    return hasNumericReference ? 'INVALID' : 'NORMAL';
  }

  if (criticalMin !== undefined && num < criticalMin) return 'CRITICAL_LOW';
  if (criticalMax !== undefined && num > criticalMax) return 'CRITICAL_HIGH';
  if (minVal !== undefined && num < minVal) return 'LOW';
  if (maxVal !== undefined && num > maxVal) return 'HIGH';

  return 'NORMAL';
}

export function isClinicallyAbnormalFlag(flag?: ParameterFlag): boolean {
  return Boolean(flag && !['NORMAL', 'PENDING', 'INVALID'].includes(flag));
}

export function computeDerivedValues(parameters: TestParameter[]): TestParameter[] {
  const rawValues = new Map<string, string>();
  parameters.forEach((parameter) => rawValues.set(parameter.id, parameter.value));

  const resolving = new Set<string>();
  const resolvedValues = new Map<string, string>();

  const resolveValue = (id: string): string => {
    if (resolvedValues.has(id)) return resolvedValues.get(id) || '';

    const rawValue = rawValues.get(id) || '';
    if (!DERIVED_PARAMETER_IDS.has(id) || resolving.has(id)) return rawValue;

    resolving.add(id);
    const numeric = (inputId: string): number => Number.parseFloat(resolveValue(inputId));
    let calculatedValue = rawValue;

    if (id === 'bili_ind') {
      const total = numeric('bili_tot');
      const direct = numeric('bili_dir');
      if (Number.isFinite(total) && Number.isFinite(direct)) calculatedValue = (total - direct).toFixed(2);
    } else if (id === 'globulin') {
      const totalProtein = numeric('tot_protein');
      const albumin = numeric('albumin');
      if (Number.isFinite(totalProtein) && Number.isFinite(albumin)) {
        calculatedValue = (totalProtein - albumin).toFixed(2);
      }
    } else if (id === 'ag_ratio') {
      const albumin = numeric('albumin');
      const globulin = numeric('globulin');
      if (Number.isFinite(albumin) && Number.isFinite(globulin) && globulin > 0) {
        calculatedValue = (albumin / globulin).toFixed(2);
      }
    } else if (id === 'bun') {
      const urea = numeric('urea');
      if (Number.isFinite(urea)) calculatedValue = (urea * 0.467).toFixed(1);
    } else if (id === 'vldl') {
      const triglycerides = numeric('triglycerides');
      if (Number.isFinite(triglycerides)) calculatedValue = Math.round(triglycerides / 5).toString();
    } else if (id === 'chol_hdl_ratio') {
      const totalCholesterol = numeric('chol_tot');
      const hdl = numeric('hdl');
      if (Number.isFinite(totalCholesterol) && Number.isFinite(hdl) && hdl > 0) {
        calculatedValue = (totalCholesterol / hdl).toFixed(2);
      }
    } else if (id === 'non_hdl') {
      const totalCholesterol = numeric('chol_tot');
      const hdl = numeric('hdl');
      if (Number.isFinite(totalCholesterol) && Number.isFinite(hdl)) {
        calculatedValue = Math.round(totalCholesterol - hdl).toString();
      }
    } else if (id === 'eag') {
      const hba1c = numeric('hba1c');
      if (Number.isFinite(hba1c)) calculatedValue = Math.round(28.7 * hba1c - 46.7).toString();
    }

    resolving.delete(id);
    resolvedValues.set(id, calculatedValue);
    return calculatedValue;
  };

  return parameters.map((parameter) => {
    const updatedValue = resolveValue(parameter.id);
    const flag = evaluateParameterFlag(
      updatedValue,
      parameter.minVal,
      parameter.maxVal,
      parameter.criticalMin,
      parameter.criticalMax,
      parameter.options,
    );

    return {
      ...parameter,
      value: updatedValue,
      flag,
    };
  });
}
