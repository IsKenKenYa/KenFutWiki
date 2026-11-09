import React from 'react';
import NoPermissionImg from '@/assets/images/no-permission.png';
import { styled, Box, Typography, Button } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

const StyledContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  height: '100vh',
  padding: theme.spacing(4),
  gap: theme.spacing(2),
}));

const StyledImage = styled('img')(() => ({
  width: '280px',
  maxWidth: '80%',
  height: 'auto',
  userSelect: 'none',
}));

const StyledActions = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
  marginTop: theme.spacing(2),
}));

const Index = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <StyledContainer>
      <StyledImage src={NoPermissionImg} alt='no-permission' />
      <Typography variant='h5' fontWeight={700} textAlign='center'>
        {t('page401.title')}
      </Typography>
      <Typography variant='body2' color='text.secondary' textAlign='center'>
        {t('page401.desc')}
      </Typography>
      <StyledActions>
        <Button variant='contained' onClick={() => navigate('/')}>
          {t('page401.backHome')}
        </Button>
        {/* <Button variant='outlined' onClick={() => navigate('/login')}>
          去登录
        </Button> */}
      </StyledActions>
    </StyledContainer>
  );
};

export default Index;
