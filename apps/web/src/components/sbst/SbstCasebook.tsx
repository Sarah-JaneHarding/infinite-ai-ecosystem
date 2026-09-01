'use client';

import { useState } from 'react';
import { MtssOverviewView } from './MtssOverviewView';
import { EgraScreeningView } from './EgraScreeningView';
import { SiasPipelineView } from './SiasPipelineView';

const TABS = [
  { id: 'mtss', label: 'MTSS Overview', emoji: '📊' },
  { id: 'egra', label: 'EGRA Screening', emoji: '📋' },
  { id: 'sias', label: 'SIAS Pipeline', emoji: '🗂️' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function SbstCasebook() {
  const [activeTab, setActiveTab] = useState<TabId>('mtss');

  return (
    <section aria-labelledby="sbst-heading">
      <h1
        id="sbst-heading"
        className="text-2xl font-bold mb-6"
        style={{ color: 'var(--iai-text)', fontFamily: 'var(--iai-font-title)' }}
      >
        SBST Support Centre
      </h1>

      {/* Tab navigation */}
      <div
        role="tablist"
        aria-label="SBST tools"
        className="flex gap-1 mb-6 p-1 rounded-[var(--iai-radius-lg)]"
        style={{ background: 'var(--iai-bg-subtle)' }}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.id}`}
              id={`tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-[var(--iai-radius-md)] text-sm font-semibold transition-colors"
              style={
                isActive
                  ? {
                      background: 'var(--iai-bg)',
                      color: 'var(--iai-text)',
                      boxShadow: '0 1px 3px rgba(0,0,0,.08)',
                    }
                  : { color: 'var(--iai-text-subtle)' }
              }
            >
              <span aria-hidden="true">{tab.emoji}</span>
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab panels */}
      {TABS.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`tabpanel-${tab.id}`}
          aria-labelledby={`tab-${tab.id}`}
          hidden={activeTab !== tab.id}
        >
          {tab.id === 'mtss' && <MtssOverviewView />}
          {tab.id === 'egra' && <EgraScreeningView />}
          {tab.id === 'sias' && <SiasPipelineView />}
        </div>
      ))}
    </section>
  );
}
