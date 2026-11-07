import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  PanResponder,
  Platform,
} from 'react-native';
import Svg, { Circle, Line, G, Text as SvgText } from 'react-native-svg';

const { width } = Dimensions.get('window');
const CLOCK_SIZE = Math.min(width * 0.85, 320);
const CENTER = CLOCK_SIZE / 2;
const RADIUS = CENTER - 16;

interface ClockPickerProps {
  initialHour?: number;
  initialMinute?: number;
  onTimeChange?: (hour: number, minute: number) => void;
  onConfirm?: () => void;
}

type Mode = 'hours' | 'minutes';

export default function ClockPicker({
  initialHour = new Date().getHours(),
  initialMinute = new Date().getMinutes(),
  onTimeChange,
  onConfirm,
}: ClockPickerProps) {
  const [hour, setHour] = useState(initialHour % 12 || 12);
  const [minute, setMinute] = useState(initialMinute);
  const [ampm, setAmpm] = useState<'AM' | 'PM'>(initialHour >= 12 ? 'PM' : 'AM');
  const [mode, setMode] = useState<Mode>('hours');

  useEffect(() => {
    const h24 = ampm === 'PM' ? (hour % 12) + 12 : hour % 12;
    onTimeChange?.(h24, minute);
  }, [hour, minute, ampm]);

  const angleToValue = useCallback(
    (x: number, y: number): number => {
      const dx = x - CENTER;
      const dy = y - CENTER;
      let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
      if (angle < 0) angle += 360;

      if (mode === 'hours') {
        const val = Math.round(angle / 30) || 12;
        return val > 12 ? val - 12 : val;
      } else {
        return Math.round(angle / 6) % 60;
      }
    },
    [mode]
  );

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      const { locationX, locationY } = evt.nativeEvent;
      const val = angleToValue(locationX, locationY);
      if (mode === 'hours') {
        setHour(val);
      } else {
        setMinute(val);
      }
    },
    onPanResponderMove: (evt) => {
      const { locationX, locationY } = evt.nativeEvent;
      const val = angleToValue(locationX, locationY);
      if (mode === 'hours') {
        setHour(val);
      } else {
        setMinute(val);
      }
    },
    onPanResponderRelease: () => {
      if (mode === 'hours') setMode('minutes');
    },
  });

  // Compute hand angle
  const hourAngle = ((hour % 12) * 30 + minute * 0.5 - 90) * (Math.PI / 180);
  const minuteAngle = (minute * 6 - 90) * (Math.PI / 180);

  const handLength = RADIUS * 0.65;
  const minuteHandLength = RADIUS * 0.82;

  const hourX2 = CENTER + handLength * Math.cos(hourAngle);
  const hourY2 = CENTER + handLength * Math.sin(hourAngle);
  const minX2 = CENTER + minuteHandLength * Math.cos(minuteAngle);
  const minY2 = CENTER + minuteHandLength * Math.sin(minuteAngle);

  // Selected dot position
  const selectedAngle =
    mode === 'hours'
      ? ((hour % 12) * 30 - 90) * (Math.PI / 180)
      : (minute * 6 - 90) * (Math.PI / 180);
  const dotRadius = RADIUS * 0.82;
  const dotX = CENTER + dotRadius * Math.cos(selectedAngle);
  const dotY = CENTER + dotRadius * Math.sin(selectedAngle);

  // Render hour/minute markers
  const renderMarkers = () => {
    const items = [];
    if (mode === 'hours') {
      for (let i = 1; i <= 12; i++) {
        const angle = ((i * 30 - 90) * Math.PI) / 180;
        const r = RADIUS * 0.82;
        const x = CENTER + r * Math.cos(angle);
        const y = CENTER + r * Math.sin(angle);
        const isSelected = i === hour;
        items.push(
          <G key={i}>
            {isSelected && <Circle cx={x} cy={y} r={18} fill="#6C63FF" />}
            <SvgText
              x={x}
              y={y + 5}
              textAnchor="middle"
              fill={isSelected ? '#fff' : '#333'}
              fontSize={14}
              fontWeight={isSelected ? 'bold' : 'normal'}
            >
              {i}
            </SvgText>
          </G>
        );
      }
    } else {
      for (let i = 0; i < 12; i++) {
        const val = i * 5;
        const angle = ((val * 6 - 90) * Math.PI) / 180;
        const r = RADIUS * 0.82;
        const x = CENTER + r * Math.cos(angle);
        const y = CENTER + r * Math.sin(angle);
        const isSelected = val === minute;
        items.push(
          <G key={i}>
            {isSelected && <Circle cx={x} cy={y} r={18} fill="#6C63FF" />}
            <SvgText
              x={x}
              y={y + 5}
              textAnchor="middle"
              fill={isSelected ? '#fff' : '#333'}
              fontSize={13}
              fontWeight={isSelected ? 'bold' : 'normal'}
            >
              {String(val).padStart(2, '0')}
            </SvgText>
          </G>
        );
      }
    }
    return items;
  };

  const displayHour = String(hour).padStart(2, '0');
  const displayMinute = String(minute).padStart(2, '0');

  return (
    <View style={styles.container}>
      {/* Time Display */}
      <View style={styles.timeDisplay}>
        <TouchableOpacity onPress={() => setMode('hours')}>
          <Text style={[styles.timeSegment, mode === 'hours' && styles.timeSegmentActive]}>
            {displayHour}
          </Text>
        </TouchableOpacity>
        <Text style={styles.timeSeparator}>:</Text>
        <TouchableOpacity onPress={() => setMode('minutes')}>
          <Text style={[styles.timeSegment, mode === 'minutes' && styles.timeSegmentActive]}>
            {displayMinute}
          </Text>
        </TouchableOpacity>

        <View style={styles.ampmContainer}>
          {(['AM', 'PM'] as const).map((period) => (
            <TouchableOpacity
              key={period}
              style={[styles.ampmButton, ampm === period && styles.ampmButtonActive]}
              onPress={() => setAmpm(period)}
            >
              <Text style={[styles.ampmText, ampm === period && styles.ampmTextActive]}>
                {period}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Clock Face */}
      <View style={styles.clockWrapper} {...panResponder.panHandlers}>
        <Svg width={CLOCK_SIZE} height={CLOCK_SIZE}>
          {/* Background */}
          <Circle cx={CENTER} cy={CENTER} r={RADIUS + 12} fill="#F5F5F5" />
          <Circle cx={CENTER} cy={CENTER} r={RADIUS + 12} fill="none" stroke="#E0E0E0" strokeWidth={1} />

          {/* Tick marks */}
          {Array.from({ length: 60 }, (_, i) => {
            const a = ((i * 6 - 90) * Math.PI) / 180;
            const isMajor = i % 5 === 0;
            const r1 = RADIUS - (isMajor ? 10 : 5);
            return (
              <Line
                key={i}
                x1={CENTER + (RADIUS - 2) * Math.cos(a)}
                y1={CENTER + (RADIUS - 2) * Math.sin(a)}
                x2={CENTER + r1 * Math.cos(a)}
                y2={CENTER + r1 * Math.sin(a)}
                stroke={isMajor ? '#BDBDBD' : '#E0E0E0'}
                strokeWidth={isMajor ? 2 : 1}
              />
            );
          })}

          {/* Hour hand */}
          <Line
            x1={CENTER}
            y1={CENTER}
            x2={hourX2}
            y2={hourY2}
            stroke="#333"
            strokeWidth={4}
            strokeLinecap="round"
          />

          {/* Minute hand */}
          <Line
            x1={CENTER}
            y1={CENTER}
            x2={minX2}
            y2={minY2}
            stroke="#6C63FF"
            strokeWidth={3}
            strokeLinecap="round"
          />

          {/* Numbers / Markers */}
          {renderMarkers()}

          {/* Center dot */}
          <Circle cx={CENTER} cy={CENTER} r={5} fill="#6C63FF" />
        </Svg>
      </View>

      {/* Mode label */}
      <Text style={styles.modeLabel}>
        {mode === 'hours' ? 'Sélectionner les heures' : 'Sélectionner les minutes'}
      </Text>

      {/* Confirm Button */}
      <TouchableOpacity
        style={styles.confirmButton}
        onPress={() => {
          const h24 = ampm === 'PM' ? (hour % 12) + 12 : hour % 12;
          onTimeChange?.(h24, minute);
            onConfirm?.();
          
        }}
      >
        <Text style={styles.confirmText}>Confirmer — {displayHour}:{displayMinute} {ampm}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: { elevation: 6 },
    }),
  },
  timeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
  },
  timeSegment: {
    fontSize: 52,
    fontWeight: '300',
    color: '#BDBDBD',
    letterSpacing: 2,
  },
  timeSegmentActive: {
    color: '#6C63FF',
    fontWeight: '600',
  },
  timeSeparator: {
    fontSize: 48,
    fontWeight: '300',
    color: '#BDBDBD',
    marginHorizontal: 4,
    lineHeight: 60,
  },
  ampmContainer: {
    marginLeft: 14,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    overflow: 'hidden',
  },
  ampmButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'transparent',
  },
  ampmButtonActive: {
    backgroundColor: '#6C63FF',
  },
  ampmText: {
    fontSize: 13,
    color: '#999',
    fontWeight: '500',
  },
  ampmTextActive: {
    color: '#fff',
  },
  clockWrapper: {
    width: CLOCK_SIZE,
    height: CLOCK_SIZE,
  },
  modeLabel: {
    marginTop: 16,
    fontSize: 13,
    color: '#9E9E9E',
    letterSpacing: 0.3,
  },
  confirmButton: {
    marginTop: 20,
    backgroundColor: '#6C63FF',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
  },
  confirmText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});