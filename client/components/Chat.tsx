import ChatIcon from '@mui/icons-material/Chat';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import Fab from '@mui/material/Fab';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ChatMessage } from '../../shared/types';

interface Props {
  messages: ChatMessage[];
  me: string;
  onSend: (text: string) => void;
}

export function Chat({ messages, me, onSend }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [seen, setSeen] = useState(messages.length);
  const endRef = useRef<HTMLDivElement>(null);
  const unread = open ? 0 : messages.slice(seen).filter((m) => m.from !== me).length;

  useEffect(() => {
    if (open) {
      setSeen(messages.length);
      endRef.current?.scrollIntoView?.({ block: 'end' });
    }
  }, [open, messages]);

  const send = () => {
    if (!text.trim()) return;
    onSend(text);
    setText('');
  };

  return (
    <>
      <Tooltip title={t('chat.title')}>
        <Fab color="primary" size="medium" aria-label={t('chat.title')} onClick={() => setOpen(true)} sx={{ position: 'fixed', right: 16, bottom: 56 }}>
          <Badge color="error" badgeContent={unread}>
            <ChatIcon />
          </Badge>
        </Fab>
      </Tooltip>
      <Drawer anchor="right" open={open} onClose={() => setOpen(false)}>
        <Box sx={{ width: { xs: '100vw', sm: 360 }, height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              {t('chat.title')}
            </Typography>
            <IconButton aria-label={t('common.close')} onClick={() => setOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
          <List sx={{ flex: 1, overflowY: 'auto' }}>
            {messages.map((m) => (
              <ListItem key={m.id} sx={{ py: 0.25 }}>
                <ListItemText
                  primary={m.from === me ? t('chat.you') : m.name}
                  secondary={m.text}
                  slotProps={{ secondary: { sx: { color: 'text.primary', wordBreak: 'break-word' } } }}
                />
              </ListItem>
            ))}
            <div ref={endRef} />
          </List>
          <Box sx={{ display: 'flex', gap: 1, p: 2 }}>
            <TextField
              fullWidth
              size="small"
              value={text}
              placeholder={t('chat.placeholder')}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              slotProps={{ htmlInput: { maxLength: 200 } }}
            />
            <Tooltip title={t('chat.send')}>
              <IconButton color="primary" aria-label={t('chat.send')} onClick={send}>
                <SendIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Drawer>
    </>
  );
}
