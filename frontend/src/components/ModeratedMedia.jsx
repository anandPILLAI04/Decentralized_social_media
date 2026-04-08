import React, { useRef } from 'react';
import { Box, IconButton } from '@mui/material';
import { PlayArrow, Pause, VolumeUp, VolumeOff, Fullscreen } from '@mui/icons-material';

const ModeratedMedia = ({
  src,
  type, // 'image' | 'video'
  alt,
  className,
  style,
  controls = false,
  autoPlay = false,
  ...props
}) => {
  const mediaRef = useRef(null);
  const [isPlaying, setIsPlaying] = React.useState(autoPlay);
  const [isMuted, setIsMuted] = React.useState(true);
  const [mediaLoaded, setMediaLoaded] = React.useState(false);

  const handleVideoControls = (action) => {
    if (!mediaRef.current) return;
    switch (action) {
      case 'play':
        isPlaying ? mediaRef.current.pause() : mediaRef.current.play();
        setIsPlaying(!isPlaying);
        break;
      case 'mute':
        mediaRef.current.muted = !isMuted;
        setIsMuted(!isMuted);
        break;
      case 'fullscreen':
        if (mediaRef.current.requestFullscreen) mediaRef.current.requestFullscreen();
        break;
    }
  };

  if (type === 'video') {
    return (
      <Box sx={{ position: 'relative' }}>
        <Box
          component="video"
          ref={mediaRef}
          src={src}
          onLoadedData={() => setMediaLoaded(true)}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          muted={isMuted}
          controls={controls}
          sx={{ maxWidth: '100%', height: 'auto', borderRadius: 1, ...style }}
          className={className}
          {...props}
        />
        {!controls && mediaLoaded && (
          <Box
            sx={{
              position: 'absolute', bottom: 8, left: 8, right: 8,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 1, px: 1, py: 0.5
            }}
          >
            <Box>
              <IconButton size="small" onClick={() => handleVideoControls('play')} sx={{ color: 'white' }}>
                {isPlaying ? <Pause /> : <PlayArrow />}
              </IconButton>
              <IconButton size="small" onClick={() => handleVideoControls('mute')} sx={{ color: 'white' }}>
                {isMuted ? <VolumeOff /> : <VolumeUp />}
              </IconButton>
            </Box>
            <IconButton size="small" onClick={() => handleVideoControls('fullscreen')} sx={{ color: 'white' }}>
              <Fullscreen />
            </IconButton>
          </Box>
        )}
      </Box>
    );
  }

  return (
    <Box
      component="img"
      ref={mediaRef}
      src={src}
      alt={alt}
      sx={{ maxWidth: '100%', height: 'auto', borderRadius: 1, ...style }}
      className={className}
      {...props}
    />
  );
};

export default ModeratedMedia;
