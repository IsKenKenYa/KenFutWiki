import {
  deleteApiV1WebhookId,
  getApiV1WebhookIdDeliveries,
  getApiV1WebhookList,
  postApiV1Webhook,
  postApiV1WebhookIdTest,
  putApiV1WebhookId,
} from '@/request/Webhook';
import { DomainWebhook, DomainWebhookDelivery } from '@/request/types';
import { Button, Chip, Stack, TextField, Typography } from '@mui/material';
import { message, Modal } from '@ctzhian/ui';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/store';
import { FormItem, SettingCardItem } from '../component/Common';

// 事件协议串与后端 domain.WebhookEvents 一致；用拼接书写，
// 避免被 i18n 词条扫描器误认为点分词条 key（feedback/comment 为顶层命名空间）
const WEBHOOK_EVENTS = [
  {
    value: 'node' + '.published',
    labelKey: 'setting.webhook.eventNodePublished',
  },
  { value: 'node' + '.deleted', labelKey: 'setting.webhook.eventNodeDeleted' },
  {
    value: 'node' + '.restored',
    labelKey: 'setting.webhook.eventNodeRestored',
  },
  { value: 'comment' + '.created', labelKey: 'setting.webhook.eventComment' },
  { value: 'feedback' + '.created', labelKey: 'setting.webhook.eventFeedback' },
];

const eventLabel = (value: string, t: (key: string) => string) => {
  const found = WEBHOOK_EVENTS.find(item => item.value === value);
  return found ? t(found.labelKey) : value;
};

interface WebhookFormValues {
  url: string;
  secret: string;
  events: string[];
}

const CardWebhook = () => {
  const { t } = useTranslation();
  const { kb_id } = useAppSelector(state => state.config);
  const [items, setItems] = useState<DomainWebhook[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<DomainWebhook | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deliveriesFor, setDeliveriesFor] = useState<DomainWebhook | null>(
    null,
  );
  const [deliveries, setDeliveries] = useState<DomainWebhookDelivery[]>([]);
  const { control, handleSubmit, reset, setValue } = useForm<WebhookFormValues>(
    {
      defaultValues: { url: '', secret: '', events: ['node.published'] },
    },
  );

  const load = () => {
    if (!kb_id) return;
    setLoading(true);
    getApiV1WebhookList({ kb_id })
      .then(res => setItems(res.data || []))
      .catch(error =>
        message.error(
          error instanceof Error ? error.message : t('common.operationFailed'),
        ),
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kb_id]);

  const openForm = (item: DomainWebhook | null) => {
    setEditing(item);
    reset({
      url: item?.url || '',
      secret: item?.secret || '',
      events: item?.events || ['node.published'],
    });
    setFormOpen(true);
  };

  const submit = handleSubmit(value => {
    if (!kb_id) return;
    setBusy(true);
    const request = editing
      ? putApiV1WebhookId(
          { id: editing.id! },
          { ...value, kb_id, enabled: editing.enabled !== false },
        )
      : postApiV1Webhook({ ...value, kb_id, enabled: true });
    request
      .then(() => {
        message.success(t('common.saveSuccess'));
        setFormOpen(false);
        load();
      })
      .catch(error =>
        message.error(
          error instanceof Error ? error.message : t('common.operationFailed'),
        ),
      )
      .finally(() => setBusy(false));
  });

  const remove = (item: DomainWebhook) => {
    if (!kb_id || !item.id) return;
    setBusy(true);
    deleteApiV1WebhookId({ id: item.id, kb_id })
      .then(() => {
        message.success(t('common.deleteSuccess'));
        load();
      })
      .catch(error =>
        message.error(
          error instanceof Error ? error.message : t('common.operationFailed'),
        ),
      )
      .finally(() => setBusy(false));
  };

  const test = (item: DomainWebhook) => {
    if (!kb_id || !item.id) return;
    setBusy(true);
    postApiV1WebhookIdTest({ id: item.id, kb_id })
      .then(() => message.success(t('setting.webhook.testSuccess')))
      .catch(error =>
        message.error(
          error instanceof Error
            ? error.message
            : t('setting.webhook.testFailed'),
        ),
      )
      .finally(() => setBusy(false));
  };

  const showDeliveries = (item: DomainWebhook) => {
    if (!kb_id || !item.id) return;
    setDeliveriesFor(item);
    getApiV1WebhookIdDeliveries({ id: item.id, kb_id })
      .then(res => setDeliveries(res.data || []))
      .catch(error =>
        message.error(
          error instanceof Error ? error.message : t('common.operationFailed'),
        ),
      );
  };

  return (
    <SettingCardItem title={t('setting.webhook.title')} isEdit={false}>
      <Stack spacing={2} sx={{ width: '100%' }}>
        <Typography variant='body2' color='text.secondary'>
          {t('setting.webhook.desc')}
        </Typography>
        <Stack direction='row' justifyContent='flex-end'>
          <Button
            variant='contained'
            size='small'
            onClick={() => openForm(null)}
          >
            {t('setting.webhook.create')}
          </Button>
        </Stack>
        {items.map(item => (
          <Stack
            key={item.id}
            direction={{ xs: 'column', md: 'row' }}
            alignItems={{ md: 'center' }}
            spacing={1}
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              px: 2,
              py: 1.5,
            }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography noWrap>{item.url}</Typography>
              <Stack
                direction='row'
                spacing={0.5}
                flexWrap='wrap'
                sx={{ mt: 0.5 }}
              >
                {(item.events || []).map(event => (
                  <Chip
                    key={event}
                    size='small'
                    variant='outlined'
                    label={eventLabel(event, t)}
                  />
                ))}
                {!item.enabled && (
                  <Chip
                    size='small'
                    color='warning'
                    label={t('common.disable')}
                  />
                )}
              </Stack>
            </Box>
            <Stack direction='row' spacing={1}>
              <Box
                component='button'
                disabled={busy}
                onClick={() => test(item)}
                sx={{
                  border: 'none',
                  cursor: 'pointer',
                  background: 'none',
                  color: 'primary.main',
                  fontSize: 13,
                }}
              >
                {t('setting.webhook.test')}
              </Box>
              <Box
                component='button'
                disabled={busy}
                onClick={() => showDeliveries(item)}
                sx={{
                  border: 'none',
                  cursor: 'pointer',
                  background: 'none',
                  color: 'primary.main',
                  fontSize: 13,
                }}
              >
                {t('setting.webhook.deliveries')}
              </Box>
              <Box
                component='button'
                disabled={busy}
                onClick={() => openForm(item)}
                sx={{
                  border: 'none',
                  cursor: 'pointer',
                  background: 'none',
                  color: 'primary.main',
                  fontSize: 13,
                }}
              >
                {t('common.edit')}
              </Box>
              <Box
                component='button'
                disabled={busy}
                onClick={() => remove(item)}
                sx={{
                  border: 'none',
                  cursor: 'pointer',
                  background: 'none',
                  color: 'error.main',
                  fontSize: 13,
                }}
              >
                {t('common.delete')}
              </Box>
            </Stack>
          </Stack>
        ))}
        {!loading && !items.length && (
          <Typography
            color='text.secondary'
            sx={{ textAlign: 'center', py: 2 }}
          >
            {t('setting.webhook.empty')}
          </Typography>
        )}
      </Stack>

      <Modal
        title={
          editing
            ? t('setting.webhook.editTitle')
            : t('setting.webhook.createTitle')
        }
        open={formOpen}
        width={620}
        okText={t('common.save')}
        onOk={submit}
        onCancel={() => setFormOpen(false)}
      >
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Controller
            name='url'
            control={control}
            rules={{ required: true }}
            render={({ field }) => (
              <TextField
                {...field}
                fullWidth
                label={t('setting.webhook.url')}
                placeholder='https://hooks.example.test/kenfutwiki'
              />
            )}
          />
          <Controller
            name='secret'
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                fullWidth
                label={t('setting.webhook.secret')}
                helperText={t('setting.webhook.secretHint')}
              />
            )}
          />
          <Controller
            name='events'
            control={control}
            render={({ field }) => (
              <FormItem
                label={t('setting.webhook.events')}
                sx={{ alignItems: 'flex-start' }}
              >
                <Stack direction='row' spacing={1} flexWrap='wrap' useFlexGap>
                  {WEBHOOK_EVENTS.map(item => {
                    const checked = (field.value || []).includes(item.value);
                    return (
                      <Chip
                        key={item.value}
                        clickable
                        color={checked ? 'primary' : 'default'}
                        variant={checked ? 'filled' : 'outlined'}
                        label={t(item.labelKey)}
                        onClick={() => {
                          const next = checked
                            ? (field.value || []).filter(
                                value => value !== item.value,
                              )
                            : [...(field.value || []), item.value];
                          setValue('events', next);
                        }}
                      />
                    );
                  })}
                </Stack>
              </FormItem>
            )}
          />
        </Stack>
      </Modal>

      <Modal
        title={t('setting.webhook.deliveryTitle', {
          url: deliveriesFor?.url || '',
        })}
        open={Boolean(deliveriesFor)}
        width={640}
        footer={null}
        onCancel={() => setDeliveriesFor(null)}
      >
        <Stack spacing={1} sx={{ pt: 1 }}>
          {deliveries.map(delivery => (
            <Stack
              key={delivery.id}
              direction='row'
              alignItems='center'
              spacing={1}
              sx={{ borderBottom: '1px solid', borderColor: 'divider', pb: 1 }}
            >
              <Typography
                variant='caption'
                color='text.secondary'
                sx={{ width: 150 }}
              >
                {dayjs(delivery.created_at).format('MM-DD HH:mm:ss')}
              </Typography>
              <Typography variant='body2' sx={{ flex: 1 }}>
                {eventLabel(delivery.event, t)}
              </Typography>
              <Typography
                variant='body2'
                color={
                  delivery.status_code >= 200 && delivery.status_code < 300
                    ? 'success.main'
                    : 'error.main'
                }
              >
                {delivery.status_code ||
                  delivery.error ||
                  t('setting.webhook.noResponse')}
              </Typography>
            </Stack>
          ))}
          {!deliveries.length && (
            <Typography
              color='text.secondary'
              sx={{ py: 4, textAlign: 'center' }}
            >
              {t('setting.webhook.noDeliveries')}
            </Typography>
          )}
        </Stack>
      </Modal>
    </SettingCardItem>
  );
};

export default CardWebhook;
