import Card from '@/components/Card';

import { useNavigate, useParams } from 'react-router-dom';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Comments from './Comments';
import Evaluate from './Evaluate';
import { Stack, Select, MenuItem } from '@mui/material';
import { CusTabs } from '@ctzhian/ui';

const Feedback = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { tab: tabParam } = useParams();
  const [tab, setTab] = useState(tabParam || 'evaluate');
  const [commentStatus, setCommentStatus] = useState(99);
  const [showCommentsFilter, setShowCommentsFilter] = useState(false);

  return (
    <Card>
      <Stack
        direction='row'
        alignItems={'center'}
        justifyContent={'space-between'}
        sx={{ p: 2 }}
      >
        <CusTabs
          value={tab}
          onChange={value => {
            setTab(value as string);
            navigate(`/feedback/${value}`);
          }}
          size='small'
          sx={{
            '.MuiButtonBase-root.Mui-disabled': {
              pointerEvents: 'auto',
            },
          }}
          list={[
            { label: t('feedback.tabEvaluate'), value: 'evaluate' },
            { label: t('feedback.tabComments'), value: 'comments' },
          ]}
        />
        {showCommentsFilter && (
          <Select
            value={commentStatus}
            sx={{ width: 120 }}
            onChange={e => {
              setCommentStatus(+e.target.value as number);
            }}
          >
            <MenuItem value={99}>{t('common.all')}</MenuItem>
            <MenuItem value={0}>{t('feedback.statusPending')}</MenuItem>
            <MenuItem value={1}>{t('feedback.statusApproved')}</MenuItem>
            <MenuItem value={-1}>{t('feedback.statusRejected')}</MenuItem>
          </Select>
        )}
      </Stack>
      {tab === 'comments' && (
        <Comments
          commentStatus={commentStatus}
          setShowCommentsFilter={setShowCommentsFilter}
        />
      )}
      {tab === 'evaluate' && <Evaluate />}
    </Card>
  );
};

export default Feedback;
