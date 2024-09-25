import React, { useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist/webpack';
import { saveAs } from 'file-saver';
import BackButton from './components/BackButton';
import './Center.css';

function BankStatementImport() {
  const [data, setData] = useState([]);
  const [bankName, setBankName] = useState(''); // State for Bank Name
  const [ledgerName, setLedgerName] = useState(''); // State for Ledger Name

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    const fileReader = new FileReader();
    fileReader.onload = async function () {
      const typedarray = new Uint8Array(this.result);

      const pdf = await pdfjsLib.getDocument(typedarray).promise;
      let fullText = '';
      for (let i = 0; i < pdf.numPages; i++) {
        const page = await pdf.getPage(i + 1);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + '\n';
      }
      const jsonData = parseBankStatement(fullText);
      setData(jsonData);
    };
    fileReader.readAsArrayBuffer(file);
  };

  const parseBankStatement = (text) => {
    const transactions = [];
    const lines = text.split(/\n/);
    lines.forEach((line) => {
      const dateMatch = line.match(/\d{2}-\d{2}-\d{4}/);
      if (dateMatch) {
        const date = dateMatch[0];
        const parts = line.split(/\s+/);
        const deposits = parseFloat(parts[parts.length - 3].replace(/,/g, ''));
        const withdrawals = parseFloat(parts[parts.length - 2].replace(/,/g, ''));
        const narration = parts.slice(1, parts.length - 3).join(' ');
        transactions.push({
          Date: date,
          'Voucher Narration': narration,
          Deposits: isNaN(deposits) ? 0 : deposits,
          Withdrawals: isNaN(withdrawals) ? 0 : withdrawals,
        });
      }
    });
    return transactions;
  };

  const parseDate = (dateValue) => {
    const [day, month, year] = dateValue.split('-');
    return `${year}${month}${day}`;
  };

  const generateTallyXML = () => {
    if (!data.length) return;

    const createXml = (data) => {
      const xmlDoc = document.implementation.createDocument('', '', null);
      const envelope = xmlDoc.createElement('ENVELOPE');

      const header = xmlDoc.createElement('HEADER');
      const tallyRequest = xmlDoc.createElement('TALLYREQUEST');
      tallyRequest.textContent = 'Import Data';
      header.appendChild(tallyRequest);
      envelope.appendChild(header);

      const body = xmlDoc.createElement('BODY');
      const importData = xmlDoc.createElement('IMPORTDATA');
      const requestDesc = xmlDoc.createElement('REQUESTDESC');
      const reportName = xmlDoc.createElement('REPORTNAME');
      reportName.textContent = 'Vouchers';
      requestDesc.appendChild(reportName);

      const staticVars = xmlDoc.createElement('STATICVARIABLES');
      const svcCompany = xmlDoc.createElement('SVCURRENTCOMPANY');
      svcCompany.textContent = 'Your Company Name';
      staticVars.appendChild(svcCompany);
      requestDesc.appendChild(staticVars);
      importData.appendChild(requestDesc);

      const requestData = xmlDoc.createElement('REQUESTDATA');

      data.forEach((row, index) => {
        const tallyMessage = xmlDoc.createElement('TALLYMESSAGE');
        const voucherType = row['Withdrawals'] ? 'Payment' : 'Receipt';
        const voucher = xmlDoc.createElement('VOUCHER');
        voucher.setAttribute('VCHTYPE', voucherType);
        voucher.setAttribute('ACTION', 'Create');
        voucher.setAttribute('OBJVIEW', 'Accounting Voucher View');

        const dateStr = parseDate(row['Date']);
        const date = xmlDoc.createElement('DATE');
        date.textContent = dateStr;
        voucher.appendChild(date);

        const vchType = xmlDoc.createElement('VOUCHERTYPENAME');
        vchType.textContent = voucherType;
        voucher.appendChild(vchType);

        const vchNumber = xmlDoc.createElement('VOUCHERNUMBER');
        vchNumber.textContent = (index + 1).toString();
        voucher.appendChild(vchNumber);

        const narration = xmlDoc.createElement('NARRATION');
        narration.textContent = row['Voucher Narration'];
        voucher.appendChild(narration);

        const ledgerEntry1 = xmlDoc.createElement('ALLLEDGERENTRIES.LIST');
        const ledgerName1 = xmlDoc.createElement('LEDGERNAME');
        ledgerName1.textContent = ledgerName; // Use the dynamic Ledger Name
        ledgerEntry1.appendChild(ledgerName1);

        const isDeemedPositive1 = xmlDoc.createElement('ISDEEMEDPOSITIVE');
        isDeemedPositive1.textContent = voucherType === 'Receipt' ? 'No' : 'Yes';
        ledgerEntry1.appendChild(isDeemedPositive1);

        const amount1 = xmlDoc.createElement('AMOUNT');
        amount1.textContent = voucherType === 'Receipt' ? row['Deposits'] : `-${row['Withdrawals']}`;
        ledgerEntry1.appendChild(amount1);
        voucher.appendChild(ledgerEntry1);

        const ledgerEntry2 = xmlDoc.createElement('ALLLEDGERENTRIES.LIST');
        const ledgerName2 = xmlDoc.createElement('LEDGERNAME');
        ledgerName2.textContent = bankName; // Use the dynamic Bank Name
        ledgerEntry2.appendChild(ledgerName2);

        const isDeemedPositive2 = xmlDoc.createElement('ISDEEMEDPOSITIVE');
        isDeemedPositive2.textContent = voucherType === 'Receipt' ? 'Yes' : 'No';
        ledgerEntry2.appendChild(isDeemedPositive2);

        const amount2 = xmlDoc.createElement('AMOUNT');
        amount2.textContent = voucherType === 'Receipt' ? `-${row['Deposits']}` : row['Withdrawals'];
        ledgerEntry2.appendChild(amount2);
        voucher.appendChild(ledgerEntry2);

        tallyMessage.appendChild(voucher);
        requestData.appendChild(tallyMessage);
      });

      importData.appendChild(requestData);
      body.appendChild(importData);
      envelope.appendChild(body);
      xmlDoc.appendChild(envelope);

      const serializer = new XMLSerializer();
      return serializer.serializeToString(xmlDoc);
    };

    const xmlContent = createXml(data);
    const blob = new Blob([xmlContent], { type: 'application/xml' });
    saveAs(blob, 'TallyData.xml');
  };

  return (
    <div className="App">
      <h1>PDF to Tally XML Converter - Bank Statement</h1>
      <div>
        <label>Bank Name</label>
        <input
          type="text"
          value={bankName}
          onChange={(e) => setBankName(e.target.value)}
        />
      </div>
      <div>
        <label>Ledger Name</label>
        <input
          type="text"
          value={ledgerName}
          onChange={(e) => setLedgerName(e.target.value)}
        />
      </div>
      <input type="file" accept="application/pdf" onChange={handleFileUpload} />
      <button onClick={generateTallyXML}>Generate Tally XML</button>
      <div className='center'>
        <BackButton />
      </div>
    </div>
  );
}

export default BankStatementImport;
