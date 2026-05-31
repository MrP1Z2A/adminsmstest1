import React, { useState, useEffect, useCallback } from 'react';
import { fetchParentPortalData, PaymentRecord } from '../services/smsService';
import { DollarSign, Download, Clock, AlertTriangle, ShieldCheck, Plus, QrCode, X, RefreshCw, FileDown } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface FinanceProps {
  studentIds?: string[];
  schoolId?: string;
}

const Finance: React.FC<FinanceProps> = ({ studentIds, schoolId }) => {
  const [activeTab, setActiveTab ] = useState<'pending' | 'history'>('pending');
  const [showQr, setShowQr] = useState(false);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setPayments([]); // Reset locally to avoid showing previous user's records
    try {
      const data = await fetchParentPortalData(studentIds || [], schoolId);
      setPayments(data.payments || []);
    } catch (e) {
      console.error('Finance fetch error:', e);
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, [studentIds?.join(','), schoolId]);

  const downloadHistory = () => {
    if (payments.length === 0) return;
    
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text('Financial Statement', 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Student ID: ${studentIds?.[0] || 'N/A'}`, 14, 30);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 35);
    
    // Summary
    const totalPaid = payments.filter(p => p.status === 'Paid').reduce((s, p) => s + p.amount, 0);
    const totalPending = payments.filter(p => p.status !== 'Paid').reduce((s, p) => s + p.amount, 0);
    
    doc.setFontSize(12);
    doc.setTextColor(2, 44, 34); // brand-950
    doc.text(`Total Paid: $${totalPaid.toLocaleString()}`, 14, 45);
    doc.setTextColor(153, 27, 27); // rose-800
    doc.text(`Outstanding Balance: $${totalPending.toLocaleString()}`, 14, 52);

    // Table
    const tableData = payments.map(p => [
      p.date,
      p.description,
      `$${p.amount.toLocaleString()}`,
      p.status.toUpperCase(),
      p.note || '-'
    ]);

    autoTable(doc, {
      startY: 60,
      head: [['Date', 'Description', 'Amount', 'Status', 'Note']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [78, 165, 157] }, // brand-500
      styles: { fontSize: 9, cellPadding: 5 },
      columnStyles: {
        2: { halign: 'right' },
        3: { halign: 'center' }
      }
    });

    doc.save(`finance_statement_${studentIds?.[0] || 'student'}.pdf`);
  };

  const downloadInvoice = (payment: PaymentRecord) => {
    const doc = new jsPDF();
    
    // Branding/Header
    doc.setFillColor(5, 150, 105); // emerald-600
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setFontSize(24);
    doc.setTextColor(255, 255, 255);
    doc.text('PAYMENT VOUCHER', 14, 28);
    
    doc.setFontSize(10);
    doc.text(`Invoice ID: ${payment.id.toUpperCase()}`, 140, 28);

    // Body
    let y = 60;
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Student Details', 14, y);
    
    y += 10;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Student ID: ${studentIds?.[0] || 'N/A'}`, 14, y);
    
    y += 20;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Payment Information', 14, y);
    
    y += 10;
    autoTable(doc, {
      startY: y,
      head: [['Description', 'Date', 'Status', 'Amount']],
      body: [[
        payment.description,
        payment.date,
        payment.status.toUpperCase(),
        `$${payment.amount.toLocaleString()}`
      ]],
      theme: 'grid',
      headStyles: { fillColor: [241, 245, 249], textColor: [71, 85, 105] }, // slate-50, slate-600
      styles: { cellPadding: 8 }
    });

    y = (doc as any).lastAutoTable.finalY + 20;
    
    if (payment.note) {
      doc.setFont('helvetica', 'bold');
      doc.text('Notes:', 14, y);
      y += 8;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(payment.note, 14, y);
      y += 20;
    }

    // Footer
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.line(14, 250, 196, 250);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text('This is an electronically generated document. No signature is required.', 105, 260, { align: 'center' });
    doc.text('Thank you for your payment!', 105, 265, { align: 'center' });

    doc.save(`invoice_${payment.id}.pdf`);
  };

  useEffect(() => { fetchData(); }, [fetchData]);

  const pendingPayments = payments.filter(p => p.status !== 'Paid');
  const paidPayments = payments.filter(p => p.status === 'Paid');
  const totalPaid = paidPayments.reduce((s, p) => s + p.amount, 0);
  const totalPending = pendingPayments.reduce((s, p) => s + p.amount, 0);
  const overdueCount = payments.filter(p => p.status === 'Overdue').length;

  const currentList = activeTab === 'pending' ? pendingPayments : paidPayments;

  return (
    <div className="space-y-6 animate-fadeIn relative pb-20">
      {/* QR Code Modal */}
      {showQr && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-sm w-full p-10 relative text-center">
            <button onClick={() => setShowQr(false)} className="absolute top-6 right-6 text-slate-400 hover:text-rose-500 bg-slate-50 p-2 rounded-xl transition-colors">
              <X className="w-5 h-5" />
            </button>
            <div className="bg-emerald-50 w-16 h-16 rounded-2xl flex items-center justify-center text-emerald-600 mx-auto mb-6">
              <QrCode className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Express Payment</h3>
            <p className="text-xs text-slate-500 mb-8 font-medium">Scan with your banking wallet to finalize transaction.</p>
            <div className="bg-slate-50 p-6 rounded-3xl border-2 border-dashed border-slate-100 flex justify-center mb-8">
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=IEMPayment&color=059669" alt="QR" className="w-40 h-40 rounded-xl" />
            </div>
            <button onClick={() => setShowQr(false)} className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl hover:bg-emerald-600 transition-all text-[10px] uppercase tracking-[0.2em] active:scale-95">
              Return to Dashboard
            </button>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Balance Outstanding</p>
          <p className="text-3xl font-black text-slate-900 tracking-tight">${loading ? '—' : totalPending.toFixed(2)}</p>
          {overdueCount > 0 && (
            <div className="mt-3 flex items-center gap-2 text-rose-600 text-[10px] font-black uppercase tracking-widest bg-rose-50 w-fit px-3 py-1 rounded-lg">
              <AlertTriangle className="w-3.5 h-3.5" /> {overdueCount} overdue
            </div>
          )}
        </div>
        <div className="bg-emerald-600 p-6 rounded-2xl shadow-xl shadow-emerald-200 text-white relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-5 opacity-10 group-hover:scale-110 transition-transform"><ShieldCheck className="w-20 h-20" /></div>
          <p className="text-emerald-100/60 text-[10px] font-black uppercase tracking-[0.2em] mb-3">Total Paid (All Time)</p>
          <div className="flex items-end justify-between">
            <p className="text-3xl font-black tracking-tight">${loading ? '—' : totalPaid.toFixed(2)}</p>
            <button
              onClick={downloadHistory}
              className="bg-white/10 hover:bg-white/20 p-2 rounded-xl transition-all border border-white/10 flex items-center gap-2 text-[8px] font-black uppercase tracking-widest"
              title="Download Full History"
            >
              <Download className="w-3.5 h-3.5" /> PDF
            </button>
          </div>
          <div className="mt-3 flex items-center gap-2 text-emerald-100 text-[10px] font-black uppercase tracking-widest">
            <ShieldCheck className="w-3.5 h-3.5" /> Verified Standing
          </div>
        </div>
        <div className="flex flex-col justify-center gap-3">
          <button className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl hover:bg-brand-600 transition-all flex items-center justify-center gap-3 text-xs uppercase tracking-widest shadow-xl active:scale-[0.98]">
            <Plus className="w-5 h-5" /> Online Payment
          </button>
          <button onClick={() => setShowQr(true)} className="w-full bg-white text-emerald-600 border-2 border-emerald-100 font-black py-3 rounded-2xl hover:bg-emerald-50 transition-all flex items-center justify-center gap-3 text-xs uppercase tracking-widest">
            <QrCode className="w-5 h-5" /> Quick QR Token
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="flex p-1.5 bg-slate-50/30 border-b border-slate-100">
          <button onClick={() => setActiveTab('pending')} className={`flex-1 py-3.5 text-[10px] font-black rounded-2xl transition-all uppercase tracking-[0.2em] ${activeTab === 'pending' ? 'bg-white shadow-md text-emerald-600 border border-emerald-50' : 'text-slate-400 hover:text-slate-600'}`}>
            Pending ({pendingPayments.length})
          </button>
          <button onClick={() => setActiveTab('history')} className={`flex-1 py-3.5 text-[10px] font-black rounded-2xl transition-all uppercase tracking-[0.2em] ${activeTab === 'history' ? 'bg-white shadow-md text-emerald-600 border border-emerald-50' : 'text-slate-400 hover:text-slate-600'}`}>
            History ({paidPayments.length})
          </button>
        </div>

        <div className="p-6 space-y-4">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => <div key={i} className="animate-pulse h-16 bg-slate-50 rounded-2xl" />)
          ) : currentList.length === 0 ? (
            <div className="text-center py-16 bg-slate-50/50 rounded-[2rem] border-2 border-dashed border-slate-100">
              <ShieldCheck className="w-16 h-16 text-slate-100 mx-auto mb-4" />
              <h4 className="text-slate-400 font-black uppercase tracking-widest text-sm">
                {activeTab === 'pending' ? 'No pending payments' : 'No payment history found'}
              </h4>
              <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest mt-2">Balance is clear</p>
            </div>
          ) : (
            currentList.map(payment => (
              <div key={payment.id} className="group border border-slate-50 rounded-3xl p-5 hover:border-emerald-100 hover:bg-emerald-50/20 transition-all flex flex-col sm:flex-row items-start sm:items-center gap-5">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${payment.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : payment.status === 'Overdue' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                  {payment.status === 'Paid' ? <DollarSign className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h4 className="font-black text-slate-800 tracking-tight truncate">{payment.description}</h4>
                    <span className={`text-[9px] font-black px-2.5 py-1 rounded-md uppercase tracking-widest shrink-0 ${payment.status === 'Paid' ? 'bg-emerald-600 text-white' : payment.status === 'Overdue' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                      {payment.status}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{payment.date}</p>
                </div>
                <div className="flex items-center gap-5 self-end sm:self-center shrink-0">
                  <div className="text-right">
                    <p className="text-xl font-black text-slate-900">${payment.amount.toFixed(2)}</p>
                  </div>
                  {payment.status === 'Paid' ? (
                    <button
                      onClick={() => downloadInvoice(payment)}
                      className="p-3 text-slate-400 hover:text-emerald-600 hover:bg-white rounded-2xl transition-all border border-transparent hover:border-slate-100 shadow-sm"
                      title="Download Invoice"
                    >
                      <FileDown className="w-5 h-5" />
                    </button>
                  ) : (
                    <button onClick={() => setShowQr(true)} className="bg-emerald-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-600/20 active:scale-95">
                      Pay Now
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Security Notice */}
      <div className="bg-slate-900 rounded-[2rem] p-6 flex items-center gap-5 relative overflow-hidden">
        <div className="bg-emerald-950 p-4 rounded-2xl text-emerald-500 shrink-0"><ShieldCheck className="w-7 h-7" /></div>
        <div>
          <h5 className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">AES-256 Protocol Active</h5>
          <p className="text-xs text-slate-400 font-medium mt-1">All transactions are processed through encrypted gateways. No raw card data is stored.</p>
        </div>
      </div>
    </div>
  );
};

export default Finance;
