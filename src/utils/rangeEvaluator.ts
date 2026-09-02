import { Gender, ParameterFlag, TestParameter } from '../types';

export function evaluateParameterFlag(
  value: string | number,
  minVal?: number,
  maxVal?: number,
  criticalMin?: number,
  criticalMax?: number,
  options?: string[]
): ParameterFlag {
  const strVal = String(value).trim();
  if (!strVal || strVal === '-' || strVal === 'N/A') {
    return 'NORMAL';
  }

  // Handle qualitative values
  const upper = strVal.toUpperCase();
  if (upper.includes('POSITIVE') || upper.includes('REACTIVE') || upper.includes('PRESENT') || upper.includes('1:160') || upper.includes('1:320') || upper.includes('+++')) {
    return 'CRITICAL_HIGH';
  }
  if (upper.includes('TRACE') || upper.includes('+ (')) {
    return 'HIGH';
  }
  if (upper.includes('NEGATIVE') || upper.includes('NON-REACTIVE') || upper.includes('NIL') || upper.includes('CLEAR') || upper.includes('< 1:80')) {
    return 'NORMAL';
  }

  // Handle numerical parsing
  const num = parseFloat(strVal);
  if (isNaN(num)) {
    return 'NORMAL';
  }

  if (criticalMin !== undefined && num < criticalMin) {
    return 'CRITICAL_LOW';
  }
  if (criticalMax !== undefined && num > criticalMax) {
    return 'CRITICAL_HIGH';
  }
  if (minVal !== undefined && num < minVal) {
    return 'LOW';
  }
  if (maxVal !== undefined && num > maxVal) {
    return 'HIGH';
  }

  return 'NORMAL';
}

export function computeDerivedValues(parameters: TestParameter[]): TestParameter[] {
  const paramMap = new Map<string, string>();
  parameters.forEach((p) => paramMap.set(p.id, p.value));

  return parameters.map((param) => {
    let updatedVal = param.value;

    // 1. Bilirubin Indirect = Total Bilirubin - Direct Bilirubin
    if (param.id === 'bili_ind') {
      const tot = parseFloat(paramMap.get('bili_tot') || '');
      const dir = parseFloat(paramMap.get('bili_dir') || '');
      if (!isNaN(tot) && !isNaN(dir)) {
        updatedVal = Math.max(0, parseFloat((tot - dir).toFixed(2))).toString();
      }
    }

    // 2. Globulin = Total Protein - Albumin
    if (param.id === 'globulin') {
      const totProt = parseFloat(paramMap.get('tot_protein') || '');
      const alb = parseFloat(paramMap.get('albumin') || '');
      if (!isNaN(totProt) && !isNaN(alb)) {
        updatedVal = Math.max(0, parseFloat((totProt - alb).toFixed(2))).toString();
      }
    }

    // 3. A:G Ratio = Albumin / Globulin
    if (param.id === 'ag_ratio') {
      const alb = parseFloat(paramMap.get('albumin') || '');
      const glob = parseFloat(paramMap.get('globulin') || '');
      if (!isNaN(alb) && !isNaN(glob) && glob > 0) {
        updatedVal = (alb / glob).toFixed(2);
      }
    }

    // 4. BUN = Blood Urea * 0.467
    if (param.id === 'bun') {
      const urea = parseFloat(paramMap.get('urea') || '');
      if (!isNaN(urea)) {
        updatedVal = (urea * 0.467).toFixed(1);
      }
    }

    // 5. VLDL = Triglycerides / 5
    if (param.id === 'vldl') {
      const tgl = parseFloat(paramMap.get('triglycerides') || '');
      if (!isNaN(tgl)) {
        updatedVal = Math.round(tgl / 5).toString();
      }
    }

    // 6. TC / HDL Ratio
    if (param.id === 'chol_hdl_ratio') {
      const tc = parseFloat(paramMap.get('chol_tot') || '');
      const hdl = parseFloat(paramMap.get('hdl') || '');
      if (!isNaN(tc) && !isNaN(hdl) && hdl > 0) {
        updatedVal = (tc / hdl).toFixed(2);
      }
    }

    // 7. Non-HDL = Total Cholesterol - HDL
    if (param.id === 'non_hdl') {
      const tc = parseFloat(paramMap.get('chol_tot') || '');
      const hdl = parseFloat(paramMap.get('hdl') || '');
      if (!isNaN(tc) && !isNaN(hdl)) {
        updatedVal = Math.max(0, Math.round(tc - hdl)).toString();
      }
    }

    // 8. eAG from HbA1c (eAG = 28.7 * HbA1c - 46.7)
    if (param.id === 'eag') {
      const hba1c = parseFloat(paramMap.get('hba1c') || '');
      if (!isNaN(hba1c)) {
        updatedVal = Math.round(28.7 * hba1c - 46.7).toString();
      }
    }

    // Evaluate flag
    const flag = evaluateParameterFlag(
      updatedVal,
      param.minVal,
      param.maxVal,
      param.criticalMin,
      param.criticalMax,
      param.options
    );

    return {
      ...param,
      value: updatedVal,
      flag,
    };
  });
}
