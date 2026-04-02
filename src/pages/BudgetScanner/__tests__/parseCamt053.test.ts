import { describe, it, expect } from 'vitest'
import { parseCamt053 } from '../parsers/parseCamt053'

const CAMT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02">
  <BkToCstmrStmt>
    <Stmt>
      <Ntry>
        <Amt Ccy="EUR">45.67</Amt>
        <CdtDbtInd>DBIT</CdtDbtInd>
        <BookgDt><Dt>2023-12-01</Dt></BookgDt>
        <NtryDtls>
          <TxDtls>
            <RltdPties>
              <CdtrAcct><Id><IBAN>NL86INGB0002445588</IBAN></Id></CdtrAcct>
              <Cdtr><Nm>Albert Heijn</Nm></Cdtr>
            </RltdPties>
            <RmtInf><Ustrd>Betaling pas 1234</Ustrd></RmtInf>
          </TxDtls>
        </NtryDtls>
      </Ntry>
      <Ntry>
        <Amt Ccy="EUR">2500.00</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <BookgDt><Dt>2023-12-05</Dt></BookgDt>
        <NtryDtls>
          <TxDtls>
            <RltdPties>
              <DbtrAcct><Id><IBAN>NL99TEST0000000001</IBAN></Id></DbtrAcct>
              <Dbtr><Nm>Werkgever BV</Nm></Dbtr>
            </RltdPties>
            <RmtInf><Ustrd>Salaris december</Ustrd></RmtInf>
          </TxDtls>
        </NtryDtls>
      </Ntry>
    </Stmt>
  </BkToCstmrStmt>
</Document>`

describe('parseCamt053', () => {
  it('returns two transactions', () => {
    expect(parseCamt053(CAMT_XML, 'camt.xml')).toHaveLength(2)
  })
  it('maps DBIT to negative bedrag', () => {
    const result = parseCamt053(CAMT_XML, 'camt.xml')
    expect(result[0].bedrag).toBe(-45.67)
  })
  it('maps CRDT to positive bedrag', () => {
    const result = parseCamt053(CAMT_XML, 'camt.xml')
    expect(result[1].bedrag).toBe(2500.00)
  })
  it('extracts datum from BookgDt/Dt', () => {
    const result = parseCamt053(CAMT_XML, 'camt.xml')
    expect(result[0].datum).toBe('2023-12-01')
  })
  it('extracts creditor name for DBIT entry', () => {
    const result = parseCamt053(CAMT_XML, 'camt.xml')
    expect(result[0].tegenpartij).toBe('Albert Heijn')
  })
  it('extracts debtor name for CRDT entry', () => {
    const result = parseCamt053(CAMT_XML, 'camt.xml')
    expect(result[1].tegenpartij).toBe('Werkgever BV')
  })
  it('extracts omschrijving from RmtInf/Ustrd', () => {
    const result = parseCamt053(CAMT_XML, 'camt.xml')
    expect(result[0].omschrijving).toBe('Betaling pas 1234')
  })
  it('sets bankFormat to CAMT053', () => {
    const result = parseCamt053(CAMT_XML, 'camt.xml')
    expect(result[0].bankFormat).toBe('CAMT053')
  })
  it('returns empty array when no Ntry elements', () => {
    const emptyXml = '<?xml version="1.0"?><Document><BkToCstmrStmt><Stmt></Stmt></BkToCstmrStmt></Document>'
    expect(parseCamt053(emptyXml, 'camt.xml')).toHaveLength(0)
  })
  it('throws on malformed XML', () => {
    expect(() => parseCamt053('not xml at all', 'camt.xml')).toThrow()
  })
})
