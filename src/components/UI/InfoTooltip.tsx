import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle } from 'lucide-react';

export const TOOLTIPS: Record<string, string> = {
    "BIN": "Building Identification Number. A unique 7-digit identifier assigned to every building in NYC.",
    "Owner": "The registered owner of the property. We cross-reference HPD and PLUTO records to find real names where possible.",
    "Year Built": "The year construction was completed. Older buildings (pre-1940) may have higher lead paint or structural risks.",
    "DOB": "Department of Buildings violations. These include construction safety issues, illegal conversions, and boiler/elevator defects.",
    "HPD": "Housing Preservation & Development violations. These track maintenance issues like pests, mold, heat, and hot water.",
    "311": "Service Requests made by residents in the past 24 months. High volume often indicates tenant distress (e.g., No Heat).",
    "FilterMap": "Adjust the minimum risk threshold to filter the map. Higher scores indicate more severe safety concerns."
};

const TooltipPortal = ({ text, x, y }: { text: string, x: number, y: number }) => {
    if (typeof document === 'undefined') return null;

    // Smart Positioning Logic
    const tooltipWidth = 240;
    const padding = 12; // Safety spacing from screen edge
    const halfWidth = tooltipWidth / 2;

    // Clamp X coordinate to keep tooltip fully on screen
    const safeX = Math.max(
        halfWidth + padding,
        Math.min(window.innerWidth - halfWidth - padding, x)
    );

    const arrowOffset = x - safeX;

    return createPortal(
        <div style={{
            position: 'fixed',
            top: y - 10,
            left: safeX,
            transform: 'translate(-50%, -100%)',
            backgroundColor: '#1e293b',
            color: '#f8fafc',
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '0.75rem',
            lineHeight: '1.4',
            width: `${tooltipWidth}px`,
            zIndex: 9999,
            pointerEvents: 'none',
            boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.1)'
        }}>
            {text}
            <div style={{
                position: 'absolute',
                top: '100%',
                left: '50%',
                marginLeft: `${arrowOffset - 5}px`,
                borderWidth: '5px',
                borderStyle: 'solid',
                borderColor: '#1e293b transparent transparent transparent'
            }} />
        </div>,
        document.body
    );
};

interface InfoTooltipProps {
    label: string;
    customText?: string;
    iconSize?: number;
    className?: string; // Allow passing external styles
    style?: React.CSSProperties;
}

export const InfoTooltip = ({ label, customText, iconSize = 12, className, style }: InfoTooltipProps) => {
    const [tooltipState, setTooltipState] = useState<{ show: boolean, x: number, y: number }>({ show: false, x: 0, y: 0 });

    const handleEnter = (e: React.MouseEvent) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setTooltipState({
            show: true,
            x: rect.left + (rect.width / 2),
            y: rect.top
        });
    };

    const handleLeave = () => {
        setTooltipState(s => ({ ...s, show: false }));
    };

    const text = customText || TOOLTIPS[label] || label;

    return (
        <>
            <div
                className={className}
                onMouseEnter={handleEnter}
                onMouseLeave={handleLeave}
                style={{
                    cursor: 'help',
                    display: 'flex',
                    alignItems: 'center',
                    transition: 'color 0.2s',
                    ...style
                }}
            >
                <HelpCircle size={iconSize} />
            </div>
            {tooltipState.show && <TooltipPortal text={text} x={tooltipState.x} y={tooltipState.y} />}
        </>
    );
};
