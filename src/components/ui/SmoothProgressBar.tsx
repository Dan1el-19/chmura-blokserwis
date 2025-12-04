import * as React from "react";
import LinearProgress, {
  LinearProgressProps,
} from "@mui/material/LinearProgress";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";

interface SmoothProgressBarProps {
  progress: number;
  className?: string;
}

function LinearProgressWithLabel(
  props: LinearProgressProps & { value: number }
) {
  return (
    <Box sx={{ display: "flex", alignItems: "center" }}>
      <Box sx={{ width: "100%", mr: 1 }}>
        <LinearProgress
          variant="determinate"
          {...props}
          sx={{
            height: 8,
            borderRadius: 4,
            backgroundColor: "#e0e0e0",
            "& .MuiLinearProgress-bar": {
              borderRadius: 4,
              backgroundColor: "#1976d2",
            },
          }}
        />
      </Box>
      <Box sx={{ minWidth: 35 }}>
        <Typography
          variant="body2"
          sx={{
            color: "text.secondary",
            fontSize: "0.875rem",
            fontWeight: 500,
          }}
        >
          {`${Math.round(props.value)}%`}
        </Typography>
      </Box>
    </Box>
  );
}

export default function SmoothProgressBar({
  progress,
  className,
}: SmoothProgressBarProps) {
  const [displayProgress, setDisplayProgress] = React.useState(0);
  const lastProgressRef = React.useRef(progress);

  React.useEffect(() => {
    // Jeśli progress się zmniejszył (np. reset), natychmiast zaktualizuj
    if (progress < lastProgressRef.current) {
      setDisplayProgress(progress);
      lastProgressRef.current = progress;
      return;
    }

    // Płynna animacja tylko dla rosnącego progress
    const timer = setInterval(() => {
      setDisplayProgress((prev) => {
        const target = Math.min(100, Math.max(0, progress));
        if (Math.abs(prev - target) < 0.5) {
          return target;
        }
        // Szybsza interpolacja dla lepszej responsywności
        const next = prev + (target - prev) * 0.3;
        return next > target ? target : next;
      });
    }, 16); // 60 FPS dla płynniejszej animacji

    lastProgressRef.current = progress;
    return () => clearInterval(timer);
  }, [progress]);

  return (
    <Box sx={{ width: "100%" }} className={className}>
      <LinearProgressWithLabel
        value={Math.min(100, Math.max(0, displayProgress))}
      />
    </Box>
  );
}
