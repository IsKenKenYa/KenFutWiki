import { DomainKnowledgeBaseDetail } from '@/request/types';
import {
  Box,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
} from '@mui/material';
import { SettingCardItem, FormItem } from './Common';
import ShowText from '@/components/ShowText';
import { Controller, useForm } from 'react-hook-form';
import { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { message } from '@ctzhian/ui';
import { getApiV1AppDetail, putApiV1App } from '@/request/App';
import { DomainAppDetailResp, DomainMCPCallListItem } from '@/request/types';
import { getApiV1McpCalls } from '@/request/Mcp';

interface CardMCPProps {
  kb: DomainKnowledgeBaseDetail;
}

const READ_TOOLS = [
  'get_wiki_info',
  'list_navs',
  'list_docs',
  'get_doc',
  'search_docs',
  'list_releases',
  'list_doc_versions',
  'get_doc_version',
];
const WRITE_TOOLS = [
  'create_nav',
  'update_nav',
  'delete_nav',
  'create_doc',
  'update_doc',
  'move_doc',
  'delete_doc',
  'restore_doc_version',
  'upload_asset',
];
const PUBLISH_TOOLS = ['publish_docs'];
const OPS_TOOLS = [
  'list_comments',
  'moderate_comment',
  'list_contributions',
  'audit_contribution',
  'get_stats',
];

const CardMCP = ({ kb }: CardMCPProps) => {
  const { t } = useTranslation();
  const [isEdit, setIsEdit] = useState(false);
  const [detail, setDetail] = useState<DomainAppDetailResp | null>(null);
  const [calls, setCalls] = useState<DomainMCPCallListItem[]>([]);

  const { control, handleSubmit, watch, setValue } = useForm({
    defaultValues: {
      is_enabled: false,
      require_auth: false,
    },
  });

  const isEnabled = watch('is_enabled');
  const requireAuth = watch('require_auth');

  const mcpUrl = useMemo(() => {
    const hostRaw = kb?.access_settings?.hosts?.[0] || window.location.hostname;
    const host = hostRaw === '*' ? window.location.hostname : hostRaw;
    const sslPorts = kb?.access_settings?.ssl_ports || [];
    const httpPorts = kb?.access_settings?.ports || [];
    const isHttps = sslPorts.length > 0;
    const protocol = isHttps ? 'https' : 'http';
    if (!host) {
      return `${protocol}://${window.location.hostname}${isHttps ? '' : `:${window.location.port}`}/mcp`;
    }
    if (isHttps) {
      return `${protocol}://${host}/mcp`;
    }
    const port = httpPorts[0];
    if (!port) return `${protocol}://${host}/mcp`;
    return `${protocol}://${host}:${port}/mcp`;
  }, [kb]);

  const mcpUrlWithKb = useMemo(
    () => `${mcpUrl}?kb_id=${encodeURIComponent(kb.id || '')}`,
    [mcpUrl, kb.id],
  );

  const claudeCodeSnippet = `claude mcp add --transport http kenfut-wiki ${mcpUrl} \\\n  --header "Authorization: Bearer <API Token>"`;
  const cursorSnippet = JSON.stringify(
    {
      mcpServers: {
        'kenfut-wiki': {
          url: mcpUrl,
          headers: {
            Authorization: 'Bearer <API Token>',
          },
        },
      },
    },
    null,
    2,
  );

  const getDetail = () => {
    getApiV1AppDetail({ kb_id: kb.id!, type: '12' }).then(res => {
      setDetail(res);
      const settings = (res.settings as any)?.mcp_server_settings ?? {};
      const legacyAuth = settings.sample_auth ?? {};
      setValue('is_enabled', settings.is_enabled ?? false);
      setValue(
        'require_auth',
        Boolean(
          settings.require_auth || (legacyAuth.enabled && legacyAuth.password),
        ),
      );
    });
  };

  const getCalls = () => {
    if (!kb.id) return;
    getApiV1McpCalls({ kb_id: kb.id, limit: 20 })
      .then(items => {
        setCalls((items as unknown as DomainMCPCallListItem[]) || []);
      })
      .catch(() => setCalls([]));
  };

  useEffect(() => {
    if (!kb) return;
    getDetail();
    getCalls();
  }, [kb]);

  const onSubmit = handleSubmit(() => {
    if (!kb || !detail) return;
    const currentSettings = (detail.settings as any) ?? {};
    const payload: any = {
      kb_id: kb.id!,
      settings: {
        ...currentSettings,
        mcp_server_settings: {
          ...(currentSettings.mcp_server_settings ?? {}),
          is_enabled: isEnabled,
          require_auth: requireAuth,
          sample_auth: { enabled: false, password: '' },
          docs_tool_settings: {
            name: 'search_docs',
            desc: t('setting.mcpToolDescDefault'),
          },
        },
      },
    };
    putApiV1App({ id: detail.id! }, payload).then(() => {
      message.success(t('common.saveSuccess'));
      setIsEdit(false);
      getDetail();
      getCalls();
    });
  });

  const renderToolGroup = (title: string, tools: string[]) => (
    <Box>
      <Box sx={{ fontSize: 12, color: 'text.tertiary', mb: 0.5 }}>{title}</Box>
      <Stack direction='row' gap={0.5} flexWrap='wrap'>
        {tools.map(tool => (
          <Box
            key={tool}
            sx={{
              px: 1,
              py: 0.25,
              borderRadius: 1,
              bgcolor: 'background.paper3',
              fontFamily: 'Mono',
              fontSize: 12,
            }}
          >
            {tool}
          </Box>
        ))}
      </Stack>
    </Box>
  );

  return (
    <Box sx={{ width: 1000, margin: 'auto', pb: 4 }}>
      <SettingCardItem
        title={t('setting.mcpTitle')}
        isEdit={isEdit}
        onSubmit={onSubmit}
        more={{
          type: 'link',
          href: '/setting?tab=backend-info',
          text: t('setting.mcpManageTokens'),
        }}
      >
        <FormItem label='MCP Server'>
          <FormControl>
            <Controller
              control={control}
              name='is_enabled'
              render={({ field }) => (
                <RadioGroup
                  {...field}
                  onChange={e => {
                    field.onChange(e.target.value === 'true');
                    setIsEdit(true);
                  }}
                >
                  <Stack direction={'row'}>
                    <FormControlLabel
                      value={true}
                      control={<Radio size='small' />}
                      label={
                        <Box sx={{ width: 100 }}>{t('common.enable')}</Box>
                      }
                    />
                    <FormControlLabel
                      value={false}
                      control={<Radio size='small' />}
                      label={
                        <Box sx={{ width: 100 }}>{t('common.disable')}</Box>
                      }
                    />
                  </Stack>
                </RadioGroup>
              )}
            />
          </FormControl>
        </FormItem>

        {isEnabled && (
          <>
            <FormItem label='MCP URL'>
              <Stack gap={1} sx={{ width: '100%' }}>
                <ShowText
                  text={[mcpUrl]}
                  copyable={true}
                  noEllipsis={true}
                  forceCopy={true}
                />
                <ShowText
                  text={[mcpUrlWithKb]}
                  copyable={true}
                  noEllipsis={true}
                  forceCopy={true}
                />
                <Box sx={{ fontSize: 12, color: 'text.tertiary' }}>
                  {t('setting.mcpUrlHint')}
                </Box>
              </Stack>
            </FormItem>

            <FormItem label={t('setting.mcpAccess')}>
              <FormControl>
                <Controller
                  control={control}
                  name='require_auth'
                  render={({ field }) => (
                    <RadioGroup
                      {...field}
                      onChange={e => {
                        field.onChange(e.target.value === 'true');
                        setIsEdit(true);
                      }}
                    >
                      <Stack direction={'row'}>
                        <FormControlLabel
                          value={false}
                          control={<Radio size='small' />}
                          label={
                            <Box sx={{ width: 220 }}>
                              {t('setting.mcpOpenReadOnly')}
                            </Box>
                          }
                        />
                        <FormControlLabel
                          value={true}
                          control={<Radio size='small' />}
                          label={
                            <Box sx={{ width: 220 }}>
                              {t('setting.mcpRequireAuth')}
                            </Box>
                          }
                        />
                      </Stack>
                    </RadioGroup>
                  )}
                />
              </FormControl>
            </FormItem>

            <FormItem label={t('setting.mcpWriteHint')} vertical>
              <Box sx={{ fontSize: 13, color: 'text.secondary' }}>
                {t('setting.mcpWriteHintContent')}
              </Box>
            </FormItem>

            <FormItem label={t('setting.mcpTools')} vertical>
              <Stack gap={1.5} sx={{ width: '100%' }}>
                {renderToolGroup(t('setting.mcpToolRead'), READ_TOOLS)}
                {renderToolGroup(t('setting.mcpToolWrite'), WRITE_TOOLS)}
                {renderToolGroup(t('setting.mcpToolPublish'), PUBLISH_TOOLS)}
                {renderToolGroup(t('setting.mcpToolOps'), OPS_TOOLS)}
              </Stack>
            </FormItem>

            <FormItem label={t('setting.mcpClientConfig')} vertical>
              <Stack gap={1.5} sx={{ width: '100%' }}>
                <Box sx={{ fontSize: 12, color: 'text.tertiary' }}>
                  {t('setting.mcpClaudeCode')}
                </Box>
                <Box
                  component='pre'
                  sx={{
                    m: 0,
                    p: 1.5,
                    borderRadius: 1,
                    bgcolor: 'background.paper3',
                    fontSize: 12,
                    overflow: 'auto',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {claudeCodeSnippet}
                </Box>
                <Box sx={{ fontSize: 12, color: 'text.tertiary' }}>
                  {t('setting.mcpCursor')}
                </Box>
                <Box
                  component='pre'
                  sx={{
                    m: 0,
                    p: 1.5,
                    borderRadius: 1,
                    bgcolor: 'background.paper3',
                    fontSize: 12,
                    overflow: 'auto',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {cursorSnippet}
                </Box>
              </Stack>
            </FormItem>

            <FormItem label={t('setting.mcpRecentCalls')} vertical>
              <Stack sx={{ width: '100%' }}>
                {calls.length === 0 ? (
                  <Box sx={{ fontSize: 12, color: 'text.tertiary' }}>
                    {t('setting.mcpNoCalls')}
                  </Box>
                ) : (
                  calls.map((call, index) => (
                    <Stack
                      key={call.id ?? index}
                      direction='row'
                      alignItems='center'
                      gap={2}
                      sx={{
                        py: 0.75,
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        '&:last-of-type': { borderBottom: 'none' },
                        fontSize: 12,
                      }}
                    >
                      <Box sx={{ width: 160, fontFamily: 'Mono' }}>
                        {call.tool_name || '-'}
                      </Box>
                      <Box
                        sx={{
                          width: 60,
                          color:
                            call.status === 'success'
                              ? 'success.main'
                              : 'error.main',
                        }}
                      >
                        {call.status || '-'}
                      </Box>
                      <Box sx={{ width: 70, color: 'text.tertiary' }}>
                        {call.duration_ms ?? 0} ms
                      </Box>
                      <Box sx={{ flex: 1, color: 'text.tertiary' }}>
                        {call.error || call.remote_ip || ''}
                      </Box>
                      <Box sx={{ color: 'text.tertiary' }}>
                        {call.created_at
                          ? new Date(call.created_at).toLocaleString()
                          : '-'}
                      </Box>
                    </Stack>
                  ))
                )}
              </Stack>
            </FormItem>
          </>
        )}
      </SettingCardItem>
    </Box>
  );
};

export default CardMCP;
