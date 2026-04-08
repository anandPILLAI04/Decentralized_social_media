import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IconButton,
  Badge,
  Popover,
  Box,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Divider,
  Button,
  CircularProgress,
  Tooltip
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  NotificationsNone as NotificationsNoneIcon,
  Favorite as FavoriteIcon,
  Comment as CommentIcon,
  PersonAdd as PersonAddIcon,
  Photo as PhotoIcon
} from '@mui/icons-material';
import { fetchNotifications, fetchUnreadCount, markNotificationRead, markAllNotificationsRead } from '../services/apiService';
import { useSocket } from '../hooks/useSocket';

function NotificationBell({ userAddress }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const pollIntervalRef = useRef(null);
  const navigate = useNavigate();
  const { on, off, connected } = useSocket();

  const open = Boolean(anchorEl);

  // Fetch unread count
  const loadUnreadCount = async () => {
    if (!userAddress) return;
    try {
      const result = await fetchUnreadCount(userAddress);
      if (result.success) {
        setUnreadCount(result.count);
      }
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  };

  // Fetch notifications
  const loadNotifications = async (pageNum = 1, append = false) => {
    if (!userAddress) return;
    setLoading(true);
    try {
      const result = await fetchNotifications(userAddress, pageNum, 20);
      if (result.success) {
        const newNotifs = result.notifications || [];
        setNotifications(prev => append ? [...prev, ...newNotifs] : newNotifs);
        setHasMore(result.pagination?.currentPage < result.pagination?.totalPages);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  // Mark notification as read and navigate
  const handleNotificationClick = async (notification) => {
    try {
      // Mark as read
      if (!notification.read) {
        await markNotificationRead(notification._id);
        setUnreadCount(prev => Math.max(0, prev - 1));
        setNotifications(prev =>
          prev.map(n => (n._id === notification._id ? { ...n, read: true } : n))
        );
      }

      // Navigate based on notification type
      handleClose();
      
      switch (notification.type) {
        case 'like':
        case 'comment':
        case 'nft_mint':
          navigate('/home');
          if (notification.content?.postId) {
            sessionStorage.setItem('scrollToPostId', notification.content.postId);
          }
          break;
          
        case 'follow':
          if (notification.sender?.address) {
            navigate(`/profile/${notification.sender.address}`);
          }
          break;
          
        case 'moderation_warning':
        case 'moderation_temp_ban':
        case 'moderation_permanent_ban':
        case 'moderation_action':
          // Stay on current page — the notification text already shows the moderation details
          break;
          
        case 'proposal_created':
        case 'proposal_vote_cast':
        case 'proposal_executed':
          navigate('/governance');
          if (notification.content?.proposalId) {
            sessionStorage.setItem('highlightProposalId', notification.content.proposalId);
          }
          break;
          
        default:
          break;
      }
    } catch (error) {
      console.error('Failed to handle notification click:', error);
    }
  };

  // Mark all as read
  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead(userAddress);
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  // Open/close popover
  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
    if (!open) {
      setPage(1);
      loadNotifications(1, false);
    }
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  // Load more notifications
  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadNotifications(nextPage, true);
  };

  // Setup polling for unread count (every 30 seconds) + WebSocket real-time updates
  useEffect(() => {
    if (!userAddress) return;

    // Initial load
    loadUnreadCount();

    // Real-time: bump unread count when a new notification arrives via WebSocket
    const handleNewNotification = () => {
      setUnreadCount(prev => prev + 1);
      // If the popover is open, refresh the list
      if (anchorEl) {
        loadNotifications(1, false);
      }
    };

    on('notification:new', handleNewNotification);

    // Fallback polling — use a longer interval if WebSocket is connected
    const pollMs = connected ? 60000 : 30000;
    pollIntervalRef.current = setInterval(() => {
      loadUnreadCount();
    }, pollMs);

    return () => {
      off('notification:new', handleNewNotification);
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [userAddress, connected]);

  // Get notification icon based on type
  const getNotificationIcon = (type) => {
    switch (type) {
      case 'like':
        return <FavoriteIcon sx={{ color: 'error.main', fontSize: 16 }} />;
      case 'comment':
        return <CommentIcon sx={{ color: 'info.main', fontSize: 16 }} />;
      case 'follow':
        return <PersonAddIcon sx={{ color: 'success.main', fontSize: 16 }} />;
      case 'nft_mint':
        return <PhotoIcon sx={{ color: 'warning.main', fontSize: 16 }} />;
      case 'moderation_warning':
      case 'moderation_temp_ban':
      case 'moderation_permanent_ban':
      case 'moderation_action':
        return <NotificationsIcon sx={{ color: 'warning.main', fontSize: 16 }} />;
      case 'proposal_created':
      case 'proposal_vote_cast':
      case 'proposal_executed':
        return <NotificationsIcon sx={{ color: 'primary.main', fontSize: 16 }} />;
      default:
        return <NotificationsIcon sx={{ fontSize: 16 }} />;
    }
  };

  // Format notification text
  const getNotificationText = (notification) => {
    const senderName = notification.sender?.username ||
                      (notification.sender?.address && notification.sender.address !== 'system'
                        ? notification.sender.address.slice(0, 8) + '...'
                        : 'System');

    switch (notification.type) {
      case 'like':
        return `${senderName} liked your post`;
      case 'comment':
        const commentText = notification.content?.commentText || '';
        const truncatedComment = commentText.length > 50 ? commentText.slice(0, 50) + '...' : commentText;
        return `${senderName} commented: "${truncatedComment}"`;
      case 'follow':
        return `${senderName} started following you`;
      case 'nft_mint':
        return `Your post was minted as an NFT!`;
      case 'moderation_warning':
        return notification.content?.message || `⚠️ ${notification.content?.title || 'Community Warning Issued'}`;
      case 'moderation_temp_ban':
        return notification.content?.message || `⏸️ ${notification.content?.title || 'Account Temporarily Suspended'}`;
      case 'moderation_permanent_ban':
        return notification.content?.message || `🔒 ${notification.content?.title || 'Account Banned'}`;
      case 'moderation_action':
        return notification.content?.message || `🛡️ Moderation Action: ${notification.content?.action || 'Account action taken'}`;
      case 'governance_status_update':
        return notification.content?.message || `📢 ${notification.content?.title || 'Governance Update'}`;
      case 'proposal_created':
        return `📝 New Proposal: ${notification.content?.title || 'Community proposal created'}`;
      case 'proposal_vote_cast':
        return `🗳️ Vote Cast: ${senderName} voted on your proposal`;
      case 'proposal_executed':
        return `✅ Proposal Executed: ${notification.content?.title || 'Proposal has been executed'}`;
      default:
        return notification.content?.message || notification.content?.title || 'New notification';
    }
  };

  // Format timestamp
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (!userAddress) return null;

  return (
    <>
      <Tooltip title="Notifications">
        <IconButton 
          onClick={handleClick} 
          sx={{ 
            color: unreadCount > 0 ? 'primary.main' : 'text.secondary',
            '&:hover': {
              color: 'primary.main',
              bgcolor: 'rgba(255, 107, 107, 0.08)'
            }
          }}
        >
          <Badge badgeContent={unreadCount} color="error" max={99}>
            {unreadCount > 0 ? <NotificationsIcon /> : <NotificationsNoneIcon />}
          </Badge>
        </IconButton>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        PaperProps={{
          sx: {
            width: 500,
            maxHeight: 600,
            mt: 1,
          },
        }}
      >
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Notifications</Typography>
          {unreadCount > 0 && (
            <Button size="small" onClick={handleMarkAllRead}>
              Mark all read
            </Button>
          )}
        </Box>
        <Divider />

        {loading && notifications.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress size={40} />
          </Box>
        ) : notifications.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <NotificationsNoneIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
            <Typography variant="body2" color="text.secondary">
              No notifications yet
            </Typography>
          </Box>
        ) : (
          <>
            <List sx={{ p: 0, maxHeight: 450, overflow: 'auto' }}>
              {notifications.map((notification, index) => (
                <Box key={notification._id}>
                  <ListItemButton
                    onClick={() => handleNotificationClick(notification)}
                    sx={{
                      bgcolor: notification.read ? 'transparent' : 'action.hover',
                      '&:hover': {
                        bgcolor: notification.read ? 'action.hover' : 'action.selected',
                      },
                    }}
                  >
                    <ListItemAvatar>
                      <Badge
                        overlap="circular"
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                        badgeContent={
                          <Box
                            sx={{
                              width: 20,
                              height: 20,
                              borderRadius: '50%',
                              bgcolor: 'background.paper',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              border: '2px solid',
                              borderColor: 'background.paper',
                            }}
                          >
                            {getNotificationIcon(notification.type)}
                          </Box>
                        }
                      >
                        <Avatar src={notification.sender.avatar} alt={notification.sender.username}>
                          {notification.sender.username?.[0]?.toUpperCase() || '?'}
                        </Avatar>
                      </Badge>
                    </ListItemAvatar>
                    <ListItemText
                      primary={getNotificationText(notification)}
                      secondary={formatTimestamp(notification.timestamp)}
                      primaryTypographyProps={{
                        sx: {
                          fontWeight: notification.read ? 400 : 600,
                          fontSize: '0.9rem',
                          whiteSpace: 'pre-wrap',
                          wordWrap: 'break-word',
                          maxWidth: '100%'
                        },
                      }}
                      secondaryTypographyProps={{
                        sx: { fontSize: '0.75rem' },
                      }}
                    />
                  </ListItemButton>
                  {index < notifications.length - 1 && <Divider component="li" />}
                </Box>
              ))}
            </List>

            {hasMore && (
              <>
                <Divider />
                <Box sx={{ p: 1, textAlign: 'center' }}>
                  <Button
                    size="small"
                    onClick={handleLoadMore}
                    disabled={loading}
                    fullWidth
                  >
                    {loading ? <CircularProgress size={20} /> : 'Load more'}
                  </Button>
                </Box>
              </>
            )}
          </>
        )}
      </Popover>
    </>
  );
}

export default NotificationBell;
