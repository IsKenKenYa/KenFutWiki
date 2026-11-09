import {
  AiGenerate2Icon,
  EditorToolbar,
  UseTiptapReturn,
} from '@ctzhian/tiptap';
import { Box } from '@mui/material';
import { useTranslation } from 'react-i18next';
import EditorPageLink from '@/features/kenfut/EditorPageLink';

interface ToolbarProps {
  editorRef: UseTiptapReturn;
  handleAiGenerate?: () => void;
}

const Toolbar = ({ editorRef, handleAiGenerate }: ToolbarProps) => {
  const { t } = useTranslation();
  return (
    <Box
      sx={{
        width: 'auto',
        display: 'flex',
        alignItems: 'center',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: '10px',
        bgcolor: 'background.default',
        px: 0.5,
        mx: 1,
      }}
    >
      <EditorPageLink editor={editorRef.editor} />
      <EditorToolbar
        editor={editorRef.editor}
        menuInToolbarMore={[
          {
            id: 'ai',
            label: t('editor.aiPolish'),
            icon: <AiGenerate2Icon sx={{ fontSize: '1rem' }} />,
            onClick: handleAiGenerate,
          },
        ]}
      />
    </Box>
  );
};

export default Toolbar;
