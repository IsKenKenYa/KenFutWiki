/**
 * 浏览器和密码管理器会把相邻的文本输入与密码输入识别为登录表单。
 * 模型 API Key、存储密钥等字段不是账号密码，需要显式忽略自动填充。
 */
export const ignoreAutofill = {
  autoComplete: 'off',
  'data-1p-ignore': 'true',
  'data-lpignore': 'true',
  'data-bwignore': 'true',
  'data-dashlane-ignore': 'true',
  'data-protonpass-ignore': 'true',
};

export const ignorePasswordAutofill = {
  ...ignoreAutofill,
  autoComplete: 'new-password',
};
