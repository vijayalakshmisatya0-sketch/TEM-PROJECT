/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { 
  Upload, 
  FileText, 
  AlertTriangle, 
  XCircle, 
  ShieldAlert, 
  Download, 
  CheckCircle2,
  Loader2,
  ChevronRight,
  Plane,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

type Category = 'Threat' | 'Error' | 'UAS';

interface Finding {
  text: string;
  category: Category;
  reason: string;
  phase?: string;
}

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [rawText, setRawText] = useState<string>('');
  const [findings, setFindings] = useState<Finding[]>([]);
  const [activeTab, setActiveTab] = useState<Category>('Threat');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadSampleData = async () => {
    setIsAnalyzing(true);
    setFile({ name: 'Sample_Flight_Narrative.docx' } as File);
    const sampleText = `Flight training session started at 0900. During cockpit prep, the maintenance placard was still on the pedestal while the engineer was finishing a tire change. This caused a 10-minute delay. 
    
    During taxi, the pilot exceeded the taxi speed limit by 5 knots while trying to make up time. On takeoff, the rotation was slightly early, leading to a low energy state initially. 
    
    In flight, we encountered unexpected turbulence at FL320. The pilot failed to secure the cabin immediately, which is a deviation from SOP 4.2. During approach, the airspeed dropped below Vref+5, resulting in a brief unstable approach state before correction.`;
    
    setRawText(sampleText);

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: `Analyze the following flight training notes and identify Threats, Errors, and Undesired Aircraft States (UAS) based on the Threat and Error Management (TEM) framework.
        
        Notes:
        ${sampleText}
        
        Return the findings as a JSON array of objects with the following structure:
        {
          "findings": [
            {
              "text": "exact quote from the notes",
              "category": "Threat" | "Error" | "UAS",
              "reason": "explanation based on SOPs",
              "phase": "flight phase (e.g., PRE-FLIGHT, DISPATCH, TAKEOFF)"
            }
          ]
        }`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              findings: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    text: { type: Type.STRING },
                    category: { type: Type.STRING, enum: ['Threat', 'Error', 'UAS'] },
                    reason: { type: Type.STRING },
                    phase: { type: Type.STRING }
                  },
                  required: ['text', 'category', 'reason']
                }
              }
            }
          }
        }
      });

      const result = JSON.parse(response.text || '{"findings": []}');
      setFindings(result.findings);
    } catch (err) {
      console.error(err);
      setError('Failed to analyze sample data.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
      await processFile(selectedFile);
    }
  };

  const processFile = async (file: File) => {
    setIsAnalyzing(true);
    try {
      // 1. Extract text via backend
      const formData = new FormData();
      formData.append('file', file);
      
      const extractRes = await fetch('/api/extract-text', {
        method: 'POST',
        body: formData,
      });
      
      if (!extractRes.ok) throw new Error('Failed to extract text from document');
      const { text } = await extractRes.json();
      setRawText(text);

      // 2. Analyze with Gemini
      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: `Analyze the following flight training notes and identify Threats, Errors, and Undesired Aircraft States (UAS) based on the Threat and Error Management (TEM) framework.
        
        Notes:
        ${text}
        
        Return the findings as a JSON array of objects with the following structure:
        {
          "findings": [
            {
              "text": "exact quote from the notes",
              "category": "Threat" | "Error" | "UAS",
              "reason": "explanation based on SOPs",
              "phase": "flight phase (e.g., PRE-FLIGHT, DISPATCH, TAKEOFF)"
            }
          ]
        }`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              findings: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    text: { type: Type.STRING },
                    category: { type: Type.STRING, enum: ['Threat', 'Error', 'UAS'] },
                    reason: { type: Type.STRING },
                    phase: { type: Type.STRING }
                  },
                  required: ['text', 'category', 'reason']
                }
              }
            }
          }
        }
      });

      const result = JSON.parse(response.text || '{"findings": []}');
      setFindings(result.findings);
    } catch (err) {
      console.error(err);
      setError('An error occurred during analysis. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const downloadAnnotated = async () => {
    try {
      const response = await fetch('/api/generate-annotated', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: rawText, findings }),
      });

      if (!response.ok) throw new Error('Failed to generate document');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Annotated_${file?.name || 'Report.docx'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setError('Failed to download annotated document.');
    }
  };

  const filteredFindings = findings.filter(f => f.category === activeTab);

  const stats = {
    Threat: findings.filter(f => f.category === 'Threat').length,
    Error: findings.filter(f => f.category === 'Error').length,
    UAS: findings.filter(f => f.category === 'UAS').length,
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans">
      {/* Header */}
      <header className="bg-[#0F172A] text-white py-4 px-6 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-500 p-2 rounded-lg">
              <Plane className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">TEM Flight Operations Safety Analysis</h1>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-widest">Threat-Error-Management Framework Processor</p>
            </div>
          </div>
          {file && (
            <button 
              onClick={() => { setFile(null); setFindings([]); }}
              className="text-sm text-slate-300 hover:text-white transition-colors flex items-center gap-2"
            >
              <XCircle className="w-4 h-4" />
              Reset Analysis
            </button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 lg:p-8">
        {!file ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto mt-12"
          >
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
              <div className="p-12 text-center">
                <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Upload className="w-10 h-10 text-blue-600" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Upload Flight Notes</h2>
                <p className="text-slate-500 mb-8">Upload your training observations (Word Doc) to begin the automated TEM analysis.</p>
                
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".docx"
                  className="hidden"
                />
                
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl font-semibold shadow-lg shadow-blue-200 transition-all active:scale-95 flex items-center gap-3 mx-auto"
                >
                  <FileText className="w-5 h-5" />
                  Select Narrative 1.docx
                </button>

                <div className="mt-8 pt-8 border-t border-slate-100">
                  <p className="text-sm text-slate-500 mb-4">Don't have a file? Try our pre-loaded sample:</p>
                  <button 
                    onClick={loadSampleData}
                    className="text-blue-600 hover:text-blue-700 font-bold text-sm flex items-center gap-2 mx-auto hover:underline"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Run Sample Flight Analysis
                  </button>
                </div>
                
                <p className="mt-6 text-xs text-slate-400 uppercase font-bold tracking-widest">Supports .docx format</p>
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="space-y-6">
            {/* Analysis Status */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-slate-100 p-3 rounded-lg">
                  <FileText className="w-6 h-6 text-slate-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">Document: {file.name}</h3>
                  <p className="text-sm text-slate-500">
                    {isAnalyzing ? 'Analyzing with detailed evidence and findings...' : 'Analysis completed across flight phases.'}
                  </p>
                </div>
              </div>
              
              {!isAnalyzing && (
                <button 
                  onClick={downloadAnnotated}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-all shadow-md shadow-emerald-100"
                >
                  <Download className="w-4 h-4" />
                  Download Annotated Doc
                </button>
              )}
            </div>

            {isAnalyzing ? (
              <div className="py-20 text-center space-y-4">
                <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto" />
                <div className="space-y-1">
                  <p className="text-lg font-semibold text-slate-700">Processing TEM Framework...</p>
                  <p className="text-sm text-slate-500">Cross-referencing observations with school SOPs and manuals.</p>
                </div>
              </div>
            ) : (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6"
              >
                {/* Stats & Tabs */}
                <div className="flex flex-wrap items-center gap-4">
                  {[
                    { id: 'Threat', label: 'THREATS', count: stats.Threat, color: 'blue', icon: ShieldAlert },
                    { id: 'Error', label: 'ERRORS', count: stats.Error, color: 'amber', icon: AlertTriangle },
                    { id: 'UAS', label: 'UAS', count: stats.UAS, color: 'red', icon: XCircle },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as Category)}
                      className={cn(
                        "flex items-center gap-3 px-6 py-3 rounded-xl font-bold transition-all border-2",
                        activeTab === tab.id 
                          ? `bg-${tab.color}-600 border-${tab.color}-600 text-white shadow-lg shadow-${tab.color}-100`
                          : `bg-white border-slate-200 text-slate-600 hover:border-${tab.color}-300`
                      )}
                    >
                      <tab.icon className="w-5 h-5" />
                      {tab.label}
                      <span className={cn(
                        "ml-2 px-2 py-0.5 rounded-md text-xs",
                        activeTab === tab.id ? "bg-white/20" : "bg-slate-100"
                      )}>
                        {tab.count}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Findings Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <AnimatePresence mode="popLayout">
                    {filteredFindings.map((finding, idx) => (
                      <motion.div
                        key={idx}
                        layout
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden group"
                      >
                        <div className="p-5 space-y-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                "text-[10px] font-bold px-2 py-1 rounded tracking-widest uppercase",
                                activeTab === 'Threat' ? "bg-blue-50 text-blue-600" :
                                activeTab === 'Error' ? "bg-amber-50 text-amber-600" :
                                "bg-red-50 text-red-600"
                              )}>
                                {finding.phase || 'GENERAL'}
                              </span>
                            </div>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button className="p-1.5 hover:bg-slate-100 rounded-md text-slate-400 hover:text-slate-600">
                                <Info className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          
                          <div className="space-y-3">
                            <h4 className="font-bold text-slate-800 leading-tight">
                              {finding.reason.split(':')[0]}
                            </h4>
                            <p className="text-sm text-slate-600 italic leading-relaxed bg-slate-50 p-3 rounded-lg border-l-4 border-slate-200">
                              "{finding.text}"
                            </p>
                            <div className="flex items-start gap-2 text-xs text-slate-500">
                              <ChevronRight className="w-4 h-4 mt-0.5 flex-shrink-0 text-slate-300" />
                              <p>{finding.reason}</p>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  
                  {filteredFindings.length === 0 && (
                    <div className="col-span-full py-12 text-center bg-white rounded-xl border border-dashed border-slate-300">
                      <CheckCircle2 className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                      <p className="text-slate-400 font-medium">No {activeTab.toLowerCase()}s identified in this analysis.</p>
                    </div>
                  )}
                </div>

                {/* Footer Action */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-4">
                  <div className="bg-amber-100 p-2 rounded-full">
                    <Info className="w-5 h-5 text-amber-600" />
                  </div>
                  <p className="text-sm text-amber-800 font-medium">
                    Review findings below, then click Submit TEM Findings to finalize.
                  </p>
                  <button className="ml-auto bg-slate-900 text-white px-6 py-2 rounded-lg font-bold text-sm hover:bg-slate-800 transition-all">
                    Submit TEM Findings
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        )}
      </main>

      {error && (
        <div className="fixed bottom-6 right-6 bg-red-600 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 animate-bounce">
          <AlertTriangle className="w-5 h-5" />
          <p className="font-bold">{error}</p>
          <button onClick={() => setError(null)} className="ml-4 hover:opacity-70">
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}
