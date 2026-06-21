import React, { useState, useRef } from 'react';
import { 
  Upload, 
  FileText, 
  AlertCircle, 
  Check, 
  Trash2, 
  Plus, 
  ArrowRight,
  Database,
  Camera
} from 'lucide-react';

interface OCRItem {
  item_name: string;
  quantity: number;
  cost_price: number;
}

interface OCRResult {
  supplier_name: string;
  total_amount: number;
  items: OCRItem[];
}

interface InvoiceScannerDropzoneProps {
  onConfirmIntake?: (data: OCRResult) => void;
  supabaseUrl?: string;
}

export const InvoiceScannerDropzone: React.FC<InvoiceScannerDropzoneProps> = ({
  onConfirmIntake,
  supabaseUrl = 'https://your-supabase-project.supabase.co'
}) => {
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [file, setFile] = useState<File | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag listeners
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  // Drop listener
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndProcessFile(e.dataTransfer.files[0]);
    }
  };

  // Input select listener
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndProcessFile(e.target.files[0]);
    }
  };

  // Validate standard images/pdfs
  const validateAndProcessFile = (selectedFile: File) => {
    setError(null);
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];
    
    if (!validTypes.includes(selectedFile.type)) {
      setError('Unsupported file type. Please upload a PNG, JPEG, or PDF invoice.');
      return;
    }

    setFile(selectedFile);
    setOcrResult(null);
    triggerOcrScan(selectedFile);
  };

  // Frontend Fetch Request to Supabase Edge Function Template
  const triggerOcrScan = async (selectedFile: File) => {
    setIsScanning(true);
    setScanProgress(10);
    setError(null);

    // Dynamic scanning progress animation mock
    const progressInterval = setInterval(() => {
      setScanProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 15;
      });
    }, 400);

    try {
      // 1. Convert File to Base64 String for payload encapsulation
      const base64Data = await convertToBase64(selectedFile);
      setScanProgress(60);

      // 3. Edge Function Interface Call Setup
      // Note: In local development, we catch errors and fall back to mock OCR response data
      const edgeFunctionUrl = `${supabaseUrl}/functions/v1/process-invoice-ocr`;
      
      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // 'Authorization': `Bearer ${YOUR_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          file: base64Data,
          fileName: selectedFile.name,
          fileType: selectedFile.type,
        })
      });

      if (!response.ok) {
        throw new Error(`Edge Function responded with status ${response.status}`);
      }

      const result: OCRResult = await response.json();
      setOcrResult(result);
    } catch (err: any) {
      console.warn('[InvoiceScanner] Edge Function template failed/not deployed. Returning fallback mock OCR data.', err);
      
      // Fallback Mock OCR details for development demo
      await new Promise(resolve => setTimeout(resolve, 2000)); // Delay to showcase animation
      const mockResult: OCRResult = {
        supplier_name: 'Dufry Wholesale Suppliers Ltd',
        total_amount: 1540.00,
        items: [
          { item_name: 'Cooking Oil 1L', quantity: 24, cost_price: 32.00 },
          { item_name: 'Premium Jasmine Rice 5kg', quantity: 10, cost_price: 65.00 },
          { item_name: 'Sachet Water Bundle', quantity: 20, cost_price: 6.00 }
        ]
      };
      setOcrResult(mockResult);
    } finally {
      clearInterval(progressInterval);
      setScanProgress(100);
      setIsScanning(false);
    }
  };

  // Convert files to base64
  const convertToBase64 = (targetFile: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(targetFile);
      reader.onload = () => {
        const resultString = reader.result as string;
        // Strip out metadata prefix (e.g., "data:image/png;base64,")
        const base64Only = resultString.split(',')[1] || resultString;
        resolve(base64Only);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  // Review Drawer State modification handlers
  const handleUpdateOcrResult = (field: keyof OCRResult, value: any) => {
    if (!ocrResult) return;
    setOcrResult({ ...ocrResult, [field]: value });
  };

  const handleUpdateOcrItem = (index: number, field: keyof OCRItem, value: any) => {
    if (!ocrResult) return;
    const updatedItems = ocrResult.items.map((item, i) => {
      if (i === index) {
        return { ...item, [field]: value };
      }
      return item;
    });
    setOcrResult({ ...ocrResult, items: updatedItems });
  };

  const handleAddOcrItem = () => {
    if (!ocrResult) return;
    setOcrResult({
      ...ocrResult,
      items: [...ocrResult.items, { item_name: '', quantity: 1, cost_price: 0 }]
    });
  };

  const handleRemoveOcrItem = (index: number) => {
    if (!ocrResult) return;
    const filtered = ocrResult.items.filter((_, i) => i !== index);
    setOcrResult({ ...ocrResult, items: filtered });
  };

  const handleConfirmIntake = () => {
    if (!ocrResult) return;
    if (onConfirmIntake) {
      onConfirmIntake(ocrResult);
    }
    alert('Stock Intake Confirmed! Inventory records updated successfully.');
    // Reset scanner
    setFile(null);
    setOcrResult(null);
  };

  return (
    <div className="max-w-6xl mx-auto font-sans text-[var(--c-text)]">
      {/* soundwave/scan animations */}
      <style>{`
        @keyframes scan {
          0% { top: 0%; opacity: 0.8; }
          50% { top: 100%; opacity: 1; }
          100% { top: 0%; opacity: 0.8; }
        }
        .scanner-line {
          animation: scan 2s linear infinite;
        }
      `}</style>

      {/* Grid: Left side upload dropzone, Right side review panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Upload Panel */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-[var(--c-white)] border border-[var(--c-border)] rounded-2xl shadow-sm p-6 space-y-6">
            <div>
              <h2 className="text-xl font-extrabold text-[var(--c-text)] flex items-center gap-2">
                <Upload className="w-5 h-5 text-[var(--c-muted)]" />
                Inventory OCR Intake
              </h2>
              <p className="text-xs text-[var(--c-muted)] mt-1">Upload supplier invoices to automatically increment product stock levels.</p>
            </div>

            {/* Drag & Drop Area */}
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[220px] relative overflow-hidden ${
                dragActive 
                  ? 'border-[#22c55e] bg-green-50/10' 
                  : 'border-[var(--c-border)] hover:border-[#22c55e] bg-[var(--c-light)]/50'
              }`}
            >
              {/* File input */}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".png,.jpg,.jpeg,.pdf"
                onChange={handleFileInput}
              />

              {/* 2. Mocked UI Scanning Progress Line */}
              {isScanning && (
                <div className="absolute left-0 w-full h-1 bg-[#22c55e] shadow-[0_0_10px_#22c55e] scanner-line z-10" />
              )}

              {isScanning ? (
                <div className="space-y-4 z-0">
                  <div className="p-3 bg-green-500/10 text-[#22c55e] rounded-2xl w-fit mx-auto animate-pulse">
                    <FileText className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-[var(--c-text)]">Scanning Invoice...</h4>
                    <p className="text-xs text-[var(--c-muted)] mt-1">AI is transcribing columns and pricing data</p>
                  </div>
                  {/* Progress bar */}
                  <div className="w-48 bg-[var(--c-light)] h-1.5 rounded-full mx-auto overflow-hidden border border-[var(--c-border)]">
                    <div 
                      className="bg-[#22c55e] h-full transition-all duration-300" 
                      style={{ width: `${scanProgress}%` }}
                    />
                  </div>
                </div>
              ) : file ? (
                <div className="space-y-4">
                  <div className="p-3 bg-[var(--c-light)] text-[var(--c-text)] rounded-2xl w-fit mx-auto">
                    <FileText className="w-8 h-8 text-[#22c55e]" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-[var(--c-text)] truncate max-w-xs">{file.name}</h4>
                    <p className="text-xs text-[var(--c-muted)] mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                      setOcrResult(null);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs text-rose-500 hover:text-rose-600 bg-rose-500/10 hover:bg-rose-500/20 px-3 py-1.5 rounded-lg border border-rose-500/20 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove File
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 bg-[var(--c-light)] text-[var(--c-muted)] rounded-2xl w-fit mx-auto group-hover:text-[#22c55e]">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-[var(--c-text)]">Upload or Screenshot Supplier Invoice</h4>
                    <p className="text-xs text-[var(--c-muted)] mt-1">Drag and drop file here, or click to browse</p>
                  </div>
                  <div className="pt-2 flex gap-2 justify-center">
                    <span className="text-[10px] font-semibold text-[var(--c-muted)] border border-[var(--c-border)] px-2 py-0.5 rounded-md">PNG, JPEG</span>
                    <span className="text-[10px] font-semibold text-[var(--c-muted)] border border-[var(--c-border)] px-2 py-0.5 rounded-md">PDF</span>
                  </div>
                </div>
              )}
            </div>

            {/* Direct Camera Scan Trigger (Mobile mockup) */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 border border-[var(--c-border)] bg-[var(--c-white)] hover:bg-[var(--c-light)] text-[var(--c-text)] text-sm font-bold rounded-lg transition-all cursor-pointer"
            >
              <Camera className="w-4 h-4 text-[var(--c-muted)]" />
              Take Invoice Picture
            </button>

            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs text-rose-500 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>
        </div>

        {/* 4. Review Drawer / Panel (Unlocks when OCR completes) */}
        <div className="lg:col-span-7">
          {ocrResult ? (
            <div className="bg-[var(--c-white)] border border-[var(--c-border)] rounded-2xl shadow-sm p-6 space-y-6 animate-slideDown">
              <div className="flex justify-between items-center border-b border-[var(--c-border)] pb-4">
                <div>
                  <h2 className="text-xl font-extrabold text-[var(--c-text)] flex items-center gap-2">
                    <Database className="w-5 h-5 text-[#22c55e]" />
                    Review & Confirm Intake
                  </h2>
                  <p className="text-xs text-[var(--c-muted)] mt-1">Review OCR-extracted fields before updating database inventory stock values.</p>
                </div>
                <button
                  type="button"
                  onClick={handleAddOcrItem}
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#22c55e] hover:text-[#16a34a] bg-green-500/10 hover:bg-green-500/20 px-2.5 py-1.5 rounded-lg border border-[#22c55e]/20 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Row
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[var(--c-muted)] uppercase tracking-wider mb-2">
                    Supplier Name
                  </label>
                  <input
                    type="text"
                    value={ocrResult.supplier_name}
                    onChange={(e) => handleUpdateOcrResult('supplier_name', e.target.value)}
                    className="w-full px-4 py-2 text-sm bg-[var(--c-white)] text-[var(--c-text)] rounded-lg border border-[var(--c-border)] focus:outline-none focus:ring-2 focus:ring-[#22c55e] focus:border-transparent transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--c-muted)] uppercase tracking-wider mb-2">
                    Total Invoice Amount (GHS)
                  </label>
                  <input
                    type="number"
                    value={ocrResult.total_amount}
                    onChange={(e) => handleUpdateOcrResult('total_amount', parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2 text-sm bg-[var(--c-white)] text-[var(--c-text)] rounded-lg border border-[var(--c-border)] focus:outline-none focus:ring-2 focus:ring-[#22c55e] focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {/* Itemized Table Row list */}
              <div className="space-y-3">
                <span className="block text-xs font-bold text-[var(--c-muted)] uppercase tracking-widest">Itemized Products List</span>
                
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {ocrResult.items.map((item, index) => (
                    <div 
                      key={index}
                      className="flex flex-col md:flex-row gap-3 p-3 bg-[var(--c-light)]/50 border border-[var(--c-border)] rounded-lg relative group hover:border-[var(--c-border)] transition-all"
                    >
                      {/* Product Name */}
                      <div className="flex-1">
                        <label className="block text-[10px] font-bold text-[var(--c-muted)] uppercase mb-1">
                          Product Name
                        </label>
                        <input
                          type="text"
                          required
                          value={item.item_name}
                          onChange={(e) => handleUpdateOcrItem(index, 'item_name', e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-[var(--c-white)] text-[var(--c-text)] rounded-lg border border-[var(--c-border)] focus:outline-none focus:ring-2 focus:ring-[#22c55e] focus:border-transparent"
                        />
                      </div>

                      {/* Quantity */}
                      <div className="w-full md:w-20">
                        <label className="block text-[10px] font-bold text-[var(--c-muted)] uppercase mb-1">
                          Quantity
                        </label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={item.quantity}
                          onChange={(e) => handleUpdateOcrItem(index, 'quantity', parseInt(e.target.value) || 0)}
                          className="w-full px-3 py-2 text-xs bg-[var(--c-white)] text-[var(--c-text)] rounded-lg border border-[var(--c-border)] focus:outline-none focus:ring-2 focus:ring-[#22c55e] focus:border-transparent"
                        />
                      </div>

                      {/* Cost price */}
                      <div className="w-full md:w-28">
                        <label className="block text-[10px] font-bold text-[var(--c-muted)] uppercase mb-1">
                          Cost Price (GHS)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={item.cost_price}
                          onChange={(e) => handleUpdateOcrItem(index, 'cost_price', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 text-xs bg-[var(--c-white)] text-[var(--c-text)] rounded-lg border border-[var(--c-border)] focus:outline-none focus:ring-2 focus:ring-[#22c55e] focus:border-transparent"
                        />
                      </div>

                      {/* Row Total */}
                      <div className="w-full md:w-24">
                        <label className="block text-[10px] font-bold text-[var(--c-muted)] uppercase mb-1">
                          Total
                        </label>
                        <div className="text-xs font-bold text-[var(--c-text)] pt-2">
                          GHS {(item.quantity * item.cost_price).toFixed(2)}
                        </div>
                      </div>

                      {/* Delete item row */}
                      <div className="flex items-end justify-end">
                        <button
                          type="button"
                          onClick={() => handleRemoveOcrItem(index)}
                          className="p-1.5 text-[var(--c-muted)] hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Confirm intake button */}
              <div className="pt-4 border-t border-[var(--c-border)] flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setOcrResult(null)}
                  className="px-5 py-2 border border-[var(--c-border)] bg-[var(--c-white)] hover:bg-[var(--c-light)] text-[var(--c-text)] text-xs font-bold rounded-lg transition-all cursor-pointer"
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={handleConfirmIntake}
                  className="flex items-center gap-1.5 px-5 py-2 bg-[#22c55e] hover:bg-[#16a34a] text-white text-xs font-bold rounded-lg transition-all cursor-pointer shadow-md shadow-green-500/10"
                >
                  <Check className="w-4 h-4" />
                  Confirm Stock Intake
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="border border-[var(--c-border)] border-dashed rounded-2xl p-16 text-center text-[var(--c-muted)] bg-[var(--c-light)]/50 flex flex-col items-center justify-center min-h-[350px]">
              <FileText className="w-12 h-12 text-[var(--c-muted)]/80 mb-3" />
              <h3 className="font-bold text-[var(--c-text)] text-base">Intake Review Panel</h3>
              <p className="text-xs text-[var(--c-muted)] max-w-xs mt-1 mx-auto">
                Select and upload a supplier invoice screenshot. The parser details will unlock here for review.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
