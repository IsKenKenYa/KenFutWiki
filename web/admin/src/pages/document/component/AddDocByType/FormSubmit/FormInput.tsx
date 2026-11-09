import { ConstsCrawlerSource } from '@/request';
import { Stack, TextField } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { FormData } from '../util';

interface FormInputProps {
  type: ConstsCrawlerSource;
  formData: FormData;
  onChange: (data: FormData) => void;
}

interface FieldConfig {
  label: string;
  placeholder: string;
  fieldName: keyof FormData;
  multiline?: boolean;
  rows?: number;
}

/**
 * 通用表单字段渲染器
 */
const FormFieldRenderer = ({
  fields,
  formData,
  onChange,
}: {
  fields: FieldConfig[];
  formData: FormData;
  onChange: (data: FormData) => void;
}) => (
  <>
    {fields.map((field, index) => (
      <div key={field.fieldName}>
        <Stack
          direction='row'
          alignItems='center'
          justifyContent='space-between'
          sx={{ fontSize: 14, lineHeight: '32px' }}
        >
          {field.label}
        </Stack>
        <TextField
          fullWidth
          multiline={field.multiline}
          rows={field.rows}
          value={formData[field.fieldName] || ''}
          placeholder={field.placeholder}
          autoFocus={index === 0}
          onChange={e =>
            onChange({ ...formData, [field.fieldName]: e.target.value })
          }
        />
      </div>
    ))}
  </>
);

const FormInput = ({ type, formData, onChange }: FormInputProps) => {
  const { t } = useTranslation();
  const formFieldsConfig: Partial<Record<ConstsCrawlerSource, FieldConfig[]>> =
    {
      [ConstsCrawlerSource.CrawlerSourceUrl]: [
        {
          label: t('addDoc.form.urlLabel'),
          placeholder: t('addDoc.form.urlPlaceholder'),
          fieldName: 'url',
          multiline: true,
          rows: 20,
        },
      ],
      [ConstsCrawlerSource.CrawlerSourceRSS]: [
        {
          label: t('addDoc.form.rssLabel'),
          placeholder: t('addDoc.form.rssPlaceholder'),
          fieldName: 'url',
        },
      ],
      [ConstsCrawlerSource.CrawlerSourceSitemap]: [
        {
          label: t('addDoc.form.sitemapLabel'),
          placeholder: t('addDoc.form.sitemapPlaceholder'),
          fieldName: 'url',
        },
      ],
      [ConstsCrawlerSource.CrawlerSourceNotion]: [
        {
          label: 'Integration Secret',
          placeholder: 'Integration Secret',
          fieldName: 'url',
        },
      ],
      [ConstsCrawlerSource.CrawlerSourceFeishu]: [
        {
          label: 'App ID',
          placeholder: t('addDoc.form.feishuAppIdPath'),
          fieldName: 'app_id',
        },
        {
          label: 'Client Secret',
          placeholder: t('addDoc.form.feishuSecretPath'),
          fieldName: 'app_secret',
        },
        {
          label: 'User Access Token',
          placeholder: '',
          fieldName: 'user_access_token',
        },
      ],
      [ConstsCrawlerSource.CrawlerSourceDingtalk]: [
        {
          label: 'App ID',
          placeholder: 'App ID',
          fieldName: 'app_id',
        },
        {
          label: 'App Secret',
          placeholder: 'App Secret',
          fieldName: 'app_secret',
        },
        {
          label: 'Union ID',
          placeholder: 'Union ID',
          fieldName: 'unionid',
        },
      ],
    };

  const fields = formFieldsConfig[type];

  if (!fields) return null;

  return (
    <FormFieldRenderer
      fields={fields}
      formData={formData}
      onChange={onChange}
    />
  );
};

export default FormInput;
