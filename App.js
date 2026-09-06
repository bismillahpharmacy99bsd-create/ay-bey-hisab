import React, {useEffect, useMemo, useState} from 'react';
import {
  SafeAreaView, View, Text, TextInput, Pressable, ScrollView,
  StyleSheet, Modal, FlatList, Alert, Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import {File, Paths} from 'expo-file-system';

const KEY = 'AY_BEY_HISAB_V2';

const defaultIncome = ['দিনের ক্যাশ','বিক্রয় বাবদ','বিক্রয়/বাবদ','ডিজিটাল/ফ্রী','অগ্রিম/চেক','অন্যান্য'];
const defaultExpense = ['পারিবারিক বাজার','বিকাশ/বাবদ','বিল পরিশোধ','লোন/কিস্তি','ব্যাংক পরিশোধ','বাকি পরিশোধ','অন্যান্য'];

const pad = n => String(n).padStart(2,'0');
const nowInfo = () => {
  const d = new Date();
  const days = ['রবিবার','সোমবার','মঙ্গলবার','বুধবার','বৃহস্পতিবার','শুক্রবার','শনিবার'];
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`,
    day: days[d.getDay()],
    time: d.toLocaleTimeString('bn-BD',{hour:'2-digit',minute:'2-digit',hour12:true})
  };
};
const money = n => Number(n||0).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:2});
const monthOf = d => String(d||'').slice(0,7);
const sum = (list,type,month='') => list.filter(x=>x.type===type && (!month || monthOf(x.date)===month)).reduce((a,x)=>a+Number(x.amount||0),0);

export default function App(){
  const [data,setData] = useState({transactions:[],incomeCats:defaultIncome,expenseCats:defaultExpense});
  const [loaded,setLoaded] = useState(false);
  const [tab,setTab] = useState('entry');
  const [type,setType] = useState('income');
  const [category,setCategory] = useState(defaultIncome[0]);
  const [details,setDetails] = useState('');
  const [amount,setAmount] = useState('');
  const [picker,setPicker] = useState(false);
  const [filterDate,setFilterDate] = useState(nowInfo().date);
  const [filterMonth,setFilterMonth] = useState(nowInfo().date.slice(0,7));
  const [reportCat,setReportCat] = useState('');
  const [reportDetail,setReportDetail] = useState('');
  const [reportType,setReportType] = useState('all');
  const [newCat,setNewCat] = useState('');
  const [editId,setEditId] = useState(null);
  const [clock,setClock] = useState(nowInfo());

  useEffect(()=>{
    (async()=>{
      try{
        const raw=await AsyncStorage.getItem(KEY);
        if(raw){
          const obj=JSON.parse(raw);
          setData({
            transactions:Array.isArray(obj.transactions)?obj.transactions:[],
            incomeCats:Array.isArray(obj.incomeCats)&&obj.incomeCats.length?obj.incomeCats:defaultIncome,
            expenseCats:Array.isArray(obj.expenseCats)&&obj.expenseCats.length?obj.expenseCats:defaultExpense
          });
        }
      }catch(e){}
      setLoaded(true);
    })();
  },[]);

  useEffect(()=>{ if(loaded) AsyncStorage.setItem(KEY,JSON.stringify(data)).catch(()=>{}); },[data,loaded]);
  useEffect(()=>{ const t=setInterval(()=>setClock(nowInfo()),30000); return ()=>clearInterval(t); },[]);
  useEffect(()=>{
    const cats=type==='income'?data.incomeCats:data.expenseCats;
    if(cats.length && !cats.includes(category)) setCategory(cats[0]);
  },[type,data.incomeCats,data.expenseCats]);

  const totals=useMemo(()=>({income:sum(data.transactions,'income'),expense:sum(data.transactions,'expense')}),[data.transactions]);
  const net=totals.income-totals.expense;
  const dayItems=data.transactions.filter(x=>x.date===filterDate);
  const monthItems=data.transactions.filter(x=>monthOf(x.date)===filterMonth);
  const reportCats=type==='income'?data.incomeCats:data.expenseCats;

  const submit=()=>{
    const num=Number(String(amount).replace(/,/g,''));
    if(!category) return Alert.alert('খাত নির্বাচন করুন');
    if(!num || num<=0) return Alert.alert('টাকার পরিমাণ দিন');
    const info=nowInfo();
    if(editId){
      setData(d=>({...d,transactions:d.transactions.map(x=>x.id===editId?{...x,type,category,details:details.trim(),amount:num}:x)}));
      setEditId(null);
      Alert.alert('সংশোধন হয়েছে','হিসাবটি আপডেট হয়েছে।');
    }else{
      const item={id:Date.now().toString(),type,date:info.date,day:info.day,time:info.time,category,details:details.trim(),amount:num};
      setData(d=>({...d,transactions:[item,...d.transactions]}));
      Alert.alert('সংরক্ষণ হয়েছে','হিসাবটি ফোনে সেভ হয়েছে।');
    }
    setAmount(''); setDetails('');
  };

  const editItem=x=>{
    setType(x.type); setCategory(x.category); setDetails(x.details||''); setAmount(String(x.amount)); setEditId(x.id); setTab('entry');
  };
  const removeItem=id=>Alert.alert('হিসাব মুছবেন?','এই হিসাবটি মুছে যাবে।',[
    {text:'না',style:'cancel'},
    {text:'মুছুন',style:'destructive',onPress:()=>setData(d=>({...d,transactions:d.transactions.filter(x=>x.id!==id)}))}
  ]);

  const addCategory=()=>{
    const c=newCat.trim(); if(!c) return;
    const key=type==='income'?'incomeCats':'expenseCats';
    if(data[key].includes(c)) return Alert.alert('এই খাত আগে থেকেই আছে');
    setData(d=>({...d,[key]:[...d[key],c]})); setCategory(c); setNewCat('');
  };
  const deleteCategory=c=>{
    const key=type==='income'?'incomeCats':'expenseCats';
    if((type==='income'&&defaultIncome.includes(c))||(type==='expense'&&defaultExpense.includes(c)))
      return Alert.alert('মূল খাত মুছবেন না','এই খাতটি অ্যাপের মূল তালিকায় রাখা হয়েছে।');
    setData(d=>({...d,[key]:d[key].filter(x=>x!==c)}));
  };

  const backup=async()=>{
    try{
      const payload=JSON.stringify({...data,backupDate:new Date().toISOString()},null,2);
      const file=new File(Paths.cache,'ay-bey-hisab-backup.json');
      file.write(payload);
      if(await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri,{mimeType:'application/json',dialogTitle:'আয়–ব্যয় হিসাবের ব্যাকআপ'});
      else Alert.alert('ব্যাকআপ তৈরি হয়েছে');
    }catch(e){Alert.alert('ব্যাকআপ করা যায়নি');}
  };
  const restore=async()=>{
    try{
      const r=await DocumentPicker.getDocumentAsync({type:'application/json',copyToCacheDirectory:true});
      if(r.canceled) return;
      const f=new File(r.assets[0].uri);
      const obj=JSON.parse(await f.text());
      if(!Array.isArray(obj.transactions)) throw new Error();
      setData({
        transactions:obj.transactions,
        incomeCats:Array.isArray(obj.incomeCats)&&obj.incomeCats.length?obj.incomeCats:defaultIncome,
        expenseCats:Array.isArray(obj.expenseCats)&&obj.expenseCats.length?obj.expenseCats:defaultExpense
      });
      Alert.alert('পুনরুদ্ধার সম্পন্ন','ব্যাকআপের হিসাব আবার অ্যাপে এসেছে।');
    }catch(e){Alert.alert('Restore করা যায়নি','সঠিক JSON backup file নির্বাচন করুন।');}
  };

  const reportItems=data.transactions.filter(x=>{
    if(reportType!=='all' && x.type!==reportType) return false;
    if(reportCat && x.category!==reportCat) return false;
    if(reportDetail && !String(x.details||'').toLowerCase().includes(reportDetail.toLowerCase())) return false;
    return true;
  });

  if(!loaded) return <SafeAreaView style={styles.center}><Text>অ্যাপ চালু হচ্ছে…</Text></SafeAreaView>;

  return <SafeAreaView style={styles.safe}>
    <View style={styles.header}>
      <Text style={styles.title}>আয়–ব্যয় হিসাব</Text>
      <Text style={styles.sub}>{clock.date} • {clock.day} • {clock.time}</Text>
    </View>

    <ScrollView contentContainerStyle={styles.body}>
      {tab==='entry' && <>
        <View style={styles.cards}>
          <Card title="মোট আয়" value={totals.income}/>
          <Card title="মোট ব্যয়" value={totals.expense}/>
          <Card title="ব্যালেন্স" value={net}/>
        </View>
        <Section title={editId?'হিসাব সংশোধন':'নতুন হিসাব'}>
          <Text style={styles.label}>১. আয় না ব্যয়?</Text>
          <View style={styles.row}>
            <Button label="আয়" active={type==='income'} onPress={()=>setType('income')}/>
            <Button label="ব্যয়" active={type==='expense'} onPress={()=>setType('expense')}/>
          </View>
          <Text style={styles.auto}>তারিখ: {clock.date}   |   বার: {clock.day}   |   সময়: {clock.time}</Text>

          <Text style={styles.label}>২. {type==='income'?'আয়ের':'ব্যয়ের'} খাত</Text>
          <Pressable style={styles.input} onPress={()=>setPicker(true)}><Text style={styles.inputText}>{category}  ▾</Text></Pressable>

          <Text style={styles.label}>৩. বিবরণ (ঐচ্ছিক)</Text>
          <TextInput value={details} onChangeText={setDetails} style={styles.input} placeholder="যেমন: ABC কোম্পানি / মাছ / আগের বাকি / আজকের বিক্রয়"/>

          <Text style={styles.label}>৪. টাকার পরিমাণ</Text>
          <TextInput value={amount} onChangeText={setAmount} style={styles.input} keyboardType="decimal-pad" placeholder="0"/>

          <Pressable style={styles.primary} onPress={submit}><Text style={styles.primaryText}>{editId?'সংশোধন সংরক্ষণ করুন':'সাবমিট / সংরক্ষণ করুন'}</Text></Pressable>
          {editId && <Pressable style={styles.secondary} onPress={()=>{setEditId(null);setAmount('');setDetails('')}}><Text>সংশোধন বাতিল</Text></Pressable>}
        </Section>
        <Section title="আজকের সারাংশ">
          <Summary income={sum(data.transactions,'income',clock.date)} expense={sum(data.transactions,'expense',clock.date)}/>
        </Section>
      </>}

      {tab==='day' && <Section title="দিনের হিসাব">
        <Text style={styles.label}>তারিখ (YYYY-MM-DD)</Text>
        <TextInput value={filterDate} onChangeText={setFilterDate} style={styles.input}/>
        <Summary income={sum(data.transactions,'income',filterDate)} expense={sum(data.transactions,'expense',filterDate)}/>
        <List items={dayItems} onDelete={removeItem} onEdit={editItem}/>
      </Section>}

      {tab==='month' && <Section title="মাসিক হিসাব">
        <Text style={styles.label}>মাস (YYYY-MM)</Text>
        <TextInput value={filterMonth} onChangeText={setFilterMonth} style={styles.input}/>
        <Summary income={sum(data.transactions,'income',filterMonth)} expense={sum(data.transactions,'expense',filterMonth)}/>
        <List items={monthItems} onDelete={removeItem} onEdit={editItem}/>
      </Section>}

      {tab==='report' && <Section title="খাত / বিবরণ অনুযায়ী হিসাব খুঁজুন">
        <Text style={styles.label}>ধরন</Text>
        <View style={styles.row}>
          <Button label="সব" active={reportType==='all'} onPress={()=>{setReportType('all');setReportCat('')}}/>
          <Button label="আয়" active={reportType==='income'} onPress={()=>setReportType('income')}/>
          <Button label="ব্যয়" active={reportType==='expense'} onPress={()=>setReportType('expense')}/>
        </View>
        <Text style={styles.label}>খাত</Text>
        <Pressable style={styles.input} onPress={()=>setPicker('report')}><Text>{reportCat||'সব খাত'}  ▾</Text></Pressable>
        <Text style={styles.label}>বিবরণ / ব্যক্তি / প্রতিষ্ঠান খুঁজুন</Text>
        <TextInput value={reportDetail} onChangeText={setReportDetail} style={styles.input} placeholder="যেমন: ABC কোম্পানি"/>
        <View style={styles.summary}>
          <Text>ফলাফল: {reportItems.length} টি</Text>
          <Text>মোট আয়: ৳ {money(reportItems.filter(x=>x.type==='income').reduce((a,x)=>a+Number(x.amount),0))}</Text>
          <Text>মোট ব্যয়: ৳ {money(reportItems.filter(x=>x.type==='expense').reduce((a,x)=>a+Number(x.amount),0))}</Text>
        </View>
        <List items={reportItems} onDelete={removeItem} onEdit={editItem}/>
      </Section>}

      {tab==='all' && <Section title="সব হিসাব">
        <Summary income={totals.income} expense={totals.expense}/>
        <List items={data.transactions} onDelete={removeItem} onEdit={editItem}/>
      </Section>}

      {tab==='settings' && <Section title="খাত ও ব্যাকআপ">
        <Text style={styles.note}>হিসাব ফোনে সংরক্ষণ হবে। নিয়মিত ব্যাকআপ নিয়ে Google Drive বা অন্য নিরাপদ জায়গায় রাখুন।</Text>
        <Pressable style={styles.primary} onPress={backup}><Text style={styles.primaryText}>ব্যাকআপ তৈরি / শেয়ার</Text></Pressable>
        <Pressable style={styles.secondary} onPress={restore}><Text>ব্যাকআপ থেকে Restore</Text></Pressable>

        <Text style={[styles.label,{marginTop:20}]}>খাত ব্যবস্থাপনা</Text>
        <View style={styles.row}>
          <Button label="আয়" active={type==='income'} onPress={()=>setType('income')}/>
          <Button label="ব্যয়" active={type==='expense'} onPress={()=>setType('expense')}/>
        </View>
        <View style={styles.catAdd}>
          <TextInput value={newCat} onChangeText={setNewCat} style={[styles.input,{flex:1}]} placeholder="নতুন খাতের নাম"/>
          <Pressable style={styles.addBtn} onPress={addCategory}><Text style={styles.primaryText}>যোগ</Text></Pressable>
        </View>
        {(type==='income'?data.incomeCats:data.expenseCats).map(c=><View key={c} style={styles.catRow}>
          <Text style={{flex:1}}>{c}</Text>
          {!((type==='income'&&defaultIncome.includes(c))||(type==='expense'&&defaultExpense.includes(c))) &&
            <Pressable onPress={()=>deleteCategory(c)}><Text style={styles.deleteText}>মুছুন</Text></Pressable>}
        </View>)}
      </Section>}
    </ScrollView>

    <View style={styles.nav}>
      {[
        ['entry','এন্ট্রি'],['day','দিন'],['month','মাস'],['report','রিপোর্ট'],['all','সব'],['settings','সেটিংস']
      ].map(([k,l])=><Pressable key={k} onPress={()=>setTab(k)} style={styles.navItem}>
        <Text style={[styles.navText,tab===k&&styles.navActive]}>{l}</Text>
      </Pressable>)}
    </View>

    <Modal visible={!!picker} transparent animationType="slide" onRequestClose={()=>setPicker(false)}>
      <View style={styles.modalBg}><View style={styles.modal}>
        <Text style={styles.modalTitle}>{picker==='report'?'খাত নির্বাচন করুন':(type==='income'?'আয়ের খাত':'ব্যয়ের খাত')}</Text>
        <FlatList
          data={picker==='report' ? (reportType==='income'?data.incomeCats:reportType==='expense'?data.expenseCats:[...new Set([...data.incomeCats,...data.expenseCats])]) : (type==='income'?data.incomeCats:data.expenseCats)}
          keyExtractor={x=>x}
          renderItem={({item})=><Pressable style={styles.pickRow} onPress={()=>{
            if(picker==='report'){setReportCat(item);setPicker(false)}
            else {setCategory(item);setPicker(false)}
          }}><Text>{item}</Text></Pressable>}
        />
        {picker==='report' && <Pressable style={styles.secondary} onPress={()=>{setReportCat('');setPicker(false)}}><Text>সব খাত</Text></Pressable>}
        <Pressable style={styles.secondary} onPress={()=>setPicker(false)}><Text>বন্ধ করুন</Text></Pressable>
      </View></View>
    </Modal>
  </SafeAreaView>;
}

function Card({title,value}){return <View style={styles.card}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.cardValue}>৳ {money(value)}</Text></View>}
function Button({label,active,onPress}){return <Pressable onPress={onPress} style={[styles.choice,active&&styles.choiceActive]}><Text style={active?styles.choiceTextActive:styles.choiceText}>{label}</Text></Pressable>}
function Summary({income,expense}){return <View style={styles.summary}><Text>আয়: ৳ {money(income)}</Text><Text>ব্যয়: ৳ {money(expense)}</Text><Text style={styles.net}>নীট: ৳ {money(income-expense)}</Text></View>}
function List({items,onDelete,onEdit}){
  if(!items.length) return <Text style={styles.empty}>কোনো হিসাব পাওয়া যায়নি।</Text>;
  return <View>{items.map(x=><View key={x.id} style={styles.item}>
    <View style={{flex:1}}>
      <Text style={styles.itemTop}>{x.date} • {x.day||''} • {x.time||''}</Text>
      <Text style={styles.itemCat}>{x.category}</Text>
      {!!x.details && <Text>{x.details}</Text>}
    </View>
    <Text style={x.type==='income'?styles.income:styles.expense}>{x.type==='income'?'+':'-'} ৳ {money(x.amount)}</Text>
    <View style={styles.actions}>
      <Pressable onPress={()=>onEdit(x)}><Text style={styles.editText}>✎</Text></Pressable>
      <Pressable onPress={()=>onDelete(x.id)}><Text style={styles.deleteText}>×</Text></Pressable>
    </View>
  </View>)}</View>
}
function Section({title,children}){return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{children}</View>}

const styles=StyleSheet.create({
  safe:{flex:1,backgroundColor:'#f5f7fb'},
  header:{padding:16,paddingTop:10,backgroundColor:'#fff',borderBottomWidth:1,borderBottomColor:'#e5e7eb'},
  title:{fontSize:24,fontWeight:'800',color:'#111827'},sub:{marginTop:3,color:'#6b7280'},
  body:{padding:12,paddingBottom:95},cards:{flexDirection:'row',gap:7,marginBottom:10},
  card:{flex:1,backgroundColor:'#fff',padding:11,borderRadius:14,elevation:2},cardTitle:{fontSize:11,color:'#6b7280'},cardValue:{fontSize:16,fontWeight:'800',marginTop:4},
  section:{backgroundColor:'#fff',borderRadius:16,padding:14,marginBottom:10,elevation:1},sectionTitle:{fontSize:18,fontWeight:'800',marginBottom:12,color:'#111827'},
  row:{flexDirection:'row',gap:7,marginBottom:8},choice:{flex:1,padding:12,borderRadius:10,borderWidth:1,borderColor:'#d1d5db',alignItems:'center'},choiceActive:{backgroundColor:'#111827',borderColor:'#111827'},
  choiceTextActive:{color:'#fff',fontWeight:'800'},choiceText:{color:'#111827',fontWeight:'700'},
  label:{fontWeight:'700',fontSize:13,color:'#374151',marginTop:8,marginBottom:5},auto:{backgroundColor:'#f3f4f6',padding:10,borderRadius:9,color:'#374151',marginBottom:5},
  input:{borderWidth:1,borderColor:'#d1d5db',borderRadius:10,padding:12,backgroundColor:'#fff',marginBottom:4},inputText:{fontWeight:'700'},
  primary:{backgroundColor:'#111827',padding:14,borderRadius:11,alignItems:'center',marginTop:12},primaryText:{color:'#fff',fontWeight:'800'},
  secondary:{padding:13,borderRadius:11,borderWidth:1,borderColor:'#d1d5db',alignItems:'center',marginTop:9},
  summary:{backgroundColor:'#f3f4f6',borderRadius:10,padding:12,gap:5,marginBottom:10},net:{fontWeight:'800'},
  item:{flexDirection:'row',alignItems:'center',paddingVertical:11,borderBottomWidth:1,borderBottomColor:'#eee'},itemTop:{fontWeight:'800',fontSize:12},itemCat:{fontWeight:'800',marginTop:2},
  income:{fontWeight:'800',fontSize:13},expense:{fontWeight:'800',fontSize:13},actions:{marginLeft:8,gap:5},editText:{fontSize:18},deleteText:{color:'#b91c1c',fontWeight:'800',fontSize:20},
  empty:{padding:20,textAlign:'center',color:'#6b7280'},note:{color:'#4b5563',lineHeight:20,marginBottom:10},
  catAdd:{flexDirection:'row',gap:8,alignItems:'center'},addBtn:{backgroundColor:'#111827',padding:13,borderRadius:10},catRow:{flexDirection:'row',paddingVertical:11,borderBottomWidth:1,borderBottomColor:'#eee'},
  nav:{position:'absolute',left:0,right:0,bottom:0,backgroundColor:'#fff',borderTopWidth:1,borderTopColor:'#e5e7eb',flexDirection:'row',paddingVertical:8,paddingBottom:Platform.OS==='ios'?18:8},
  navItem:{flex:1,alignItems:'center'},navText:{fontSize:10,color:'#6b7280',fontWeight:'700'},navActive:{color:'#111827'},
  modalBg:{flex:1,backgroundColor:'rgba(0,0,0,.35)',justifyContent:'flex-end'},modal:{backgroundColor:'#fff',padding:18,borderTopLeftRadius:20,borderTopRightRadius:20,maxHeight:'75%'},
  modalTitle:{fontSize:20,fontWeight:'800',marginBottom:8},pickRow:{padding:15,borderBottomWidth:1,borderBottomColor:'#eee'},center:{flex:1,alignItems:'center',justifyContent:'center'}
});
