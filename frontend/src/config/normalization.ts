import { ComparisonNormalizationConfig } from '../types/api';

export const INITIAL_DATE_NORMALIZATION_FORMATS = [
  '%Y-%m-%d',
  '%d/%m/%Y',
  '%m/%d/%Y',
  '%d-%m-%Y',
  '%m-%d-%Y',
];

export const INITIAL_NORMALIZATION_CONFIG: ComparisonNormalizationConfig = {
  treat_empty_as_null: true,
  null_tokens: ['null', 'na', 'n/a', 'none'],
  null_token_case_insensitive: true,
  case_insensitive: false,
  trim_whitespace: false,
  date_normalization: {
    enabled: false,
    formats: INITIAL_DATE_NORMALIZATION_FORMATS,
  },
};
