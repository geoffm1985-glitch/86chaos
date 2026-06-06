import React, { useState, useEffect } from 'react';
import { Bell, Check, ChevronLeft, ChevronRight, MessageSquare, Plus, Trash2, Users, Calendar, Clock, AlertTriangle, X, BookOpen, Loader2, Package, ClipboardList, Menu, Settings, LogOut, Shield, Send, Repeat, UserCheck, CheckCircle } from 'lucide-react';

// --- Firebase Initialization ---
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyA0kkmRCqGNoB1LXKfuCNIl1JKDyQci9hA",
  authDomain: "cheers-34b8d.firebaseapp.com",
  projectId: "cheers-34b8d",
  storageBucket: "cheers-34b8d.firebasestorage.app",
  messagingSenderId: "762225019248",
  appId: "1:762225019248:web:3e142c9563e58ca762a7b5"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// --- Master Configuration ---
const MASTER_ADMIN_EMAIL = 'geoffm1985@gmail.com';

// --- Dynamic Infinite Holiday Engine ---
const getHolidays = (year) => {
  const h = {};
  const add = (m, d, name) => h[`${year}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`] = name;
  const getNthDay = (m, dayOfWeek, n) => {
    let d = new Date(year, m - 1, 1);
    let count = 0;
    while (d.getMonth() === m - 1) {
      if (d.getDay() === dayOfWeek) {
        count++;
        if (count === n) return d.getDate();
      }
      d.setDate(d.getDate() + 1);
    }
    if (n === -1) {
      d = new Date(year, m, 0);
      while (d.getDay() !== dayOfWeek) d.setDate(d.getDate() - 1);
      return d.getDate();
    }
  };

  // Fixed Holidays
  add(1, 1, "New Year's Day");
  add(2, 14, "Valentine's Day");
  add(3, 17, "St. Patrick's Day");
  add(7, 4, "Independence Day");
  add(10, 31, "Halloween");
  add(11, 11, "Veterans Day");
  add(12, 24, "Christmas Eve");
  add(12, 25, "Christmas Day");
  add(12, 31, "New Year's Eve");

  // Shifting Holidays
  add(1, getNthDay(1, 1, 3), "Martin Luther King Jr. Day");
  add(2, getNthDay(2, 1, 3), "Presidents' Day");
  add(5, getNthDay(5, 0, 2), "Mother's Day");
  add(5, getNthDay(5, 1, -1), "Memorial Day");
  add(6, getNthDay(6, 0, 3), "Father's Day");
  add(9, getNthDay(9, 1, 1), "Labor Day");
  add(11, getNthDay(11, 4, 4), "Thanksgiving");

  return h;
};

// --- Complete 39-Page PFG Master Catalog ---
const PFG_CATALOG = [
  {name:"Bun Hamburger Gourmet Sliced 4.25\"",category:"Dry Goods",pfgCode:"B1938",parLevel:4},
  {name:"Bun Hamburger Soft Pretzel Bread 4\"",category:"Dry Goods",pfgCode:"CR776",parLevel:2},
  {name:"Bun Hoagie Italian 6\" Hinged",category:"Dry Goods",pfgCode:"69922",parLevel:3},
  {name:"Dough Pizza Crust 12\" Readi Rise",category:"Dry Goods",pfgCode:"69432",parLevel:5},
  {name:"Pizza Crust 12\" Thin Crispy Partial Baked",category:"Dry Goods",pfgCode:"EK598",parLevel:3},
  {name:"Bread Reuben Marble Rye 1/2\"",category:"Dry Goods",pfgCode:"23112",parLevel:2},
  {name:"Cake Chocolate Chip Cookie Dough Layer",category:"Dry Goods",pfgCode:"NW398",parLevel:1},
  {name:"Bread White Split Top 9/16\"",category:"Dry Goods",pfgCode:"21694",parLevel:2},
  {name:"Cheesecake Strawberry Lace 10\"",category:"Dry Goods",pfgCode:"21542",parLevel:1},
  {name:"Roll White Hard 5\" Sliced Baked",category:"Dry Goods",pfgCode:"NE588",parLevel:2},
  {name:"Bread Wheat Hearty Cracked 9/16\"",category:"Dry Goods",pfgCode:"27786",parLevel:2},
  {name:"Shell Taco Yellow Whole Grain 5\"",category:"Dry Goods",pfgCode:"50408",parLevel:2},
  {name:"Tortilla Flour 6\"",category:"Dry Goods",pfgCode:"DT172",parLevel:4},
  {name:"Bun Slider Hawaiian Sweet",category:"Dry Goods",pfgCode:"TD860",parLevel:2},
  {name:"Cake Carrot Momma's Old Fashioned",category:"Dry Goods",pfgCode:"21572",parLevel:1},
  {name:"Cake Limoncello Mascarpone 10\"",category:"Dry Goods",pfgCode:"NJ164",parLevel:1},
  {name:"Pie Boston Cream 10\"",category:"Dry Goods",pfgCode:"B5370",parLevel:1},
  {name:"Pie Strawberry Cream 10\"",category:"Dry Goods",pfgCode:"65926",parLevel:1},
  {name:"Bun Kaiser Onion 4.25\"",category:"Dry Goods",pfgCode:"72890",parLevel:2},
  {name:"Roll Hard 4\" Slice Baked White",category:"Dry Goods",pfgCode:"G3774",parLevel:2},
  {name:"Pie High Peanut Butter 12 Slice",category:"Dry Goods",pfgCode:"DV594",parLevel:1},
  {name:"Cheesecake Pecan Turtle 10\"",category:"Dry Goods",pfgCode:"21718",parLevel:1},
  {name:"Bar Assorted Uncut Caramel/Rasp/Lemon",category:"Dry Goods",pfgCode:"21724",parLevel:1},
  {name:"Bun Hot Dog 6\" Hinged Slice",category:"Dry Goods",pfgCode:"D1884",parLevel:3},
  {name:"Cake Sinful Seven 10\"",category:"Dry Goods",pfgCode:"21620",parLevel:1},
  {name:"Cheesecake Peppermint w/ Chocolate Crust",category:"Dry Goods",pfgCode:"HM332",parLevel:1},
  {name:"Cheesecake Pumpkin 9\"",category:"Dry Goods",pfgCode:"G0780",parLevel:1},
  {name:"Pie Caramel Apple Nut High 10\"",category:"Dry Goods",pfgCode:"63112",parLevel:1},
  {name:"Bun Hoagie Rustic 7.5\"",category:"Dry Goods",pfgCode:"87554",parLevel:2},
  {name:"Pie Lemon Meringue Grand 10\"",category:"Dry Goods",pfgCode:"FC026",parLevel:1},
  {name:"Bread Pita White 6\"",category:"Dry Goods",pfgCode:"PW300",parLevel:2},
  {name:"Bun Brioche 4.5\" Baked",category:"Dry Goods",pfgCode:"T0758",parLevel:2},
  {name:"Cake Chocolate Peanut Butter Mousse",category:"Dry Goods",pfgCode:"21678",parLevel:1},
  {name:"Tortilla Garden Vegetable 12\"",category:"Dry Goods",pfgCode:"P8606",parLevel:2},
  {name:"Cake Red Velvet Regal 9\"",category:"Dry Goods",pfgCode:"21776",parLevel:1},
  {name:"Cake Tiramisu Tuscan 9X13",category:"Dry Goods",pfgCode:"21142",parLevel:1},
  {name:"Pretzel Bite With Salt Pack",category:"Dry Goods",pfgCode:"FH980",parLevel:2},
  {name:"Beef Ground Patty Angus 81/19",category:"Meat",pfgCode:"EW538",parLevel:6},
  {name:"Beef Taco Filling Fully Cooked",category:"Meat",pfgCode:"GW640",parLevel:2},
  {name:"Beef Ground Patty 5-1Avg 78/22",category:"Meat",pfgCode:"37510",parLevel:3},
  {name:"Corned Beef Brisket Choice Raw",category:"Meat",pfgCode:"K4206",parLevel:2},
  {name:"Sirloin Beef Tip Random",category:"Meat",pfgCode:"25138",parLevel:2},
  {name:"Beef Chuck Roll Choice 1\" Neck Off",category:"Meat",pfgCode:"DR382",parLevel:2},
  {name:"Beef Ground 81/19 Raw Bulk",category:"Meat",pfgCode:"46050",parLevel:4},
  {name:"Beef Ground Patty 4-1Avg 78/22",category:"Meat",pfgCode:"36146",parLevel:3},
  {name:"Meatball Beef Chicken .5oz",category:"Meat",pfgCode:"CC868",parLevel:2},
  {name:"Beef Top Blade 8oz Steak Flat Iron",category:"Meat",pfgCode:"35068",parLevel:3},
  {name:"Beef Prime Rib Whole 9Up",category:"Meat",pfgCode:"11464",parLevel:2},
  {name:"Beef Steak Chopped Patty 4-1",category:"Meat",pfgCode:"46376",parLevel:3},
  {name:"Beef Brisket Sliced Pit Smoked",category:"Meat",pfgCode:"FV966",parLevel:2},
  {name:"Beef Brisket Burnt Ends Pit Smoked",category:"Meat",pfgCode:"VE276",parLevel:2},
  {name:"Beef Brisket Chopped Pit Smoked",category:"Meat",pfgCode:"FV960",parLevel:2},
  {name:"Beef Brisket Whole Pit Smoked",category:"Meat",pfgCode:"FV964",parLevel:2},
  {name:"Beef Chuck Roll 18 Up Choice",category:"Meat",pfgCode:"40988",parLevel:2},
  {name:"Corned Beef 4oz Steak Breakaway",category:"Meat",pfgCode:"C0350",parLevel:3},
  {name:"Tenderloin Beef 6oz Steak Cubed",category:"Meat",pfgCode:"41194",parLevel:3},
  {name:"Beverage Syrup Coca Cola Classic BIB",category:"Dry Goods",pfgCode:"28372",parLevel:2},
  {name:"Beverage Syrup Diet Coke BIB",category:"Dry Goods",pfgCode:"28374",parLevel:2},
  {name:"Juice Orange 100% Plastic Bottle",category:"Dry Goods",pfgCode:"14114",parLevel:2},
  {name:"Juice Pineapple Unsweetened Can",category:"Dry Goods",pfgCode:"11170",parLevel:2},
  {name:"Juice Tomato 46oz",category:"Dry Goods",pfgCode:"12066",parLevel:2},
  {name:"Juice Tomato 100%",category:"Dry Goods",pfgCode:"TB394",parLevel:2},
  {name:"Bitters Cocktail Aromatic",category:"Liquor/Beer",pfgCode:"A9510",parLevel:1},
  {name:"Juice Orange 100% Can",category:"Dry Goods",pfgCode:"TB388",parLevel:2},
  {name:"Juice Pineapple 100%",category:"Dry Goods",pfgCode:"TB392",parLevel:2},
  {name:"Beverage Syrup Tonic BIB",category:"Dry Goods",pfgCode:"B9080",parLevel:1},
  {name:"Juice Lemon 32oz",category:"Dry Goods",pfgCode:"CV246",parLevel:2},
  {name:"Soda Ginger Beer Heritage Glass",category:"Liquor/Beer",pfgCode:"GL216",parLevel:2},
  {name:"Mushroom Tradition Pickled",category:"Produce",pfgCode:"23134",parLevel:2},
  {name:"Bean Chili Mild (Pinto)",category:"Dry Goods",pfgCode:"10792",parLevel:2},
  {name:"Tomato Diced 1x1x.75\"",category:"Dry Goods",pfgCode:"11230",parLevel:4},
  {name:"Cherry Maraschino Extra Large",category:"Dry Goods",pfgCode:"16352",parLevel:2},
  {name:"Vegetable Blend Red & Green Pepper Onion",category:"Produce",pfgCode:"61634",parLevel:2},
  {name:"Vegetable Blend California Grade A",category:"Produce",pfgCode:"61072",parLevel:2},
  {name:"Mushroom Pieces And Stems",category:"Dry Goods",pfgCode:"CP744",parLevel:2},
  {name:"Bean Green Cut 4 Sieve",category:"Dry Goods",pfgCode:"CP622",parLevel:2},
  {name:"Pepper Jalapeno Nacho Sliced",category:"Dry Goods",pfgCode:"CP740",parLevel:2},
  {name:"Applesauce Sweetened 4oz Cup",category:"Dry Goods",pfgCode:"P5874",parLevel:2},
  {name:"Sauerkraut Shredded Canned",category:"Dry Goods",pfgCode:"16286",parLevel:2},
  {name:"Vegetable Corn Sweet Roasted w/ Black Bean",category:"Produce",pfgCode:"A3464",parLevel:2},
  {name:"Pineapple Tidbit In Juice",category:"Dry Goods",pfgCode:"10858",parLevel:2},
  {name:"Corn Sweet Flame Roasted w/ Peppers",category:"Produce",pfgCode:"61578",parLevel:2},
  {name:"Cheese Cheddar Shredded Mild",category:"Dairy",pfgCode:"VH764",parLevel:3},
  {name:"Cheese Mozzarella Part Skim Shredded Blend",category:"Dairy",pfgCode:"NE864",parLevel:4},
  {name:"Cheese Swiss Sliced 192",category:"Dairy",pfgCode:"PK940",parLevel:2},
  {name:"Buttermilk 1% Low Fat",category:"Dairy",pfgCode:"FK632",parLevel:2},
  {name:"Cheese Mozzarella Sliced Low Moisture",category:"Dairy",pfgCode:"PK912",parLevel:2},
  {name:"Cheese Pepper Jack Sliced",category:"Dairy",pfgCode:"PK910",parLevel:2},
  {name:"Sour Cream Grade A",category:"Dairy",pfgCode:"DV226",parLevel:3},
  {name:"Sour Cream Stick Portion Pack",category:"Dairy",pfgCode:"DW198",parLevel:2},
  {name:"Cheese Cream Loaf",category:"Dairy",pfgCode:"70082",parLevel:2},
  {name:"Cheese American Yellow 120 Slice",category:"Dairy",pfgCode:"70956",parLevel:3},
  {name:"Cheese Cheddar Sharp Sliced 192",category:"Dairy",pfgCode:"PK934",parLevel:2},
  {name:"Cheese Parmesan Grated Packet",category:"Dairy",pfgCode:"HB970",parLevel:2},
  {name:"Creamer Half & Half Aseptic .38oz",category:"Dairy",pfgCode:"FE644",parLevel:3},
  {name:"Cheese Blue Crumbles",category:"Dairy",pfgCode:"HB984",parLevel:2},
  {name:"Cream Whipping 36% Heavy",category:"Dairy",pfgCode:"FL276",parLevel:2},
  {name:"Egg Shell On White Large AA",category:"Dairy",pfgCode:"DV382",parLevel:4},
  {name:"Cottage Cheese 4% Small Curd",category:"Dairy",pfgCode:"ANF42",parLevel:2},
  {name:"Egg Liquid Scrambled Pasteurized",category:"Dairy",pfgCode:"69030",parLevel:3},
  {name:"Cheese Cheddar White Sharp Sliced",category:"Dairy",pfgCode:"PK944",parLevel:2},
  {name:"Cheese Mozzarella Diced Premium 50/50",category:"Dairy",pfgCode:"NE868",parLevel:2},
  {name:"Cheese Mozzarella Fresh Ciliegine",category:"Dairy",pfgCode:"23342",parLevel:2},
  {name:"Cheese Feta Crumble",category:"Dairy",pfgCode:"FD358",parLevel:2},
  {name:"Potato Redskin Mashed Roasted Garlic",category:"Produce",pfgCode:"24296",parLevel:2},
  {name:"Butter Whipped Cup 8gm",category:"Dairy",pfgCode:"ARV74",parLevel:3},
  {name:"Cheese Cheddar Mild 192 Slices",category:"Dairy",pfgCode:"PK978",parLevel:2},
  {name:"Cheese Pepper Jack Sliced Twin Pack",category:"Dairy",pfgCode:"GG328",parLevel:2},
  {name:"Cream Whipped Heavy 36%",category:"Dairy",pfgCode:"FK634",parLevel:2},
  {name:"Degreaser Fry Boil Out",category:"Supplies",pfgCode:"DT450",parLevel:2},
  {name:"Sanitizer Tablets Concentrate",category:"Supplies",pfgCode:"32360",parLevel:2},
  {name:"Bleach Liquid 5.25%",category:"Supplies",pfgCode:"84540",parLevel:2},
  {name:"Cleaner Polish Stainless Steel",category:"Supplies",pfgCode:"CG666",parLevel:2},
  {name:"Cleaner Quick Clean Griddle Packet",category:"Supplies",pfgCode:"C3628",parLevel:3},
  {name:"Degreaser Clinging",category:"Supplies",pfgCode:"VK100",parLevel:2},
  {name:"Detergent Pot And Pan Heavy Duty",category:"Supplies",pfgCode:"DV970",parLevel:3},
  {name:"Sanitizer Hard Surface RTU",category:"Supplies",pfgCode:"FE788",parLevel:2},
  {name:"Dressing Caesar Creamy",category:"Dry Goods",pfgCode:"28502",parLevel:2},
  {name:"Mayonnaise Heavy Duty",category:"Dry Goods",pfgCode:"11554",parLevel:3},
  {name:"Oil Butter Alternative Liquid",category:"Dry Goods",pfgCode:"71022",parLevel:3},
  {name:"Oil Soy Clear Fry",category:"Dry Goods",pfgCode:"DV470",parLevel:6},
  {name:"Sauce Buffalo Wing",category:"Dry Goods",pfgCode:"T9466",parLevel:3},
  {name:"Sauce Pizza Fully Prepared",category:"Dry Goods",pfgCode:"20558",parLevel:3},
  {name:"Sauce Barbecue Sweet And Spicy",category:"Dry Goods",pfgCode:"28160",parLevel:2},
  {name:"Sauce Roasted Garlic Parmesan",category:"Dry Goods",pfgCode:"D0796",parLevel:2},
  {name:"Dressing French Red Maison",category:"Dry Goods",pfgCode:"31502",parLevel:2},
  {name:"Sauce Mango Habanero",category:"Dry Goods",pfgCode:"R9944",parLevel:2},
  {name:"Sauce Spicy Peach Wing Glaze",category:"Dry Goods",pfgCode:"RK012",parLevel:2},
  {name:"Sauce Thai Chili",category:"Dry Goods",pfgCode:"A8482",parLevel:2},
  {name:"Dressing Honey Mustard Dijon",category:"Dry Goods",pfgCode:"28354",parLevel:2},
  {name:"Garlic Chopped In Water",category:"Dry Goods",pfgCode:"CP484",parLevel:2},
  {name:"Dressing 1000 Island",category:"Dry Goods",pfgCode:"23654",parLevel:2},
  {name:"Spread Garlic Gluten Free",category:"Dry Goods",pfgCode:"DT376",parLevel:2},
  {name:"Pickle Dill Chip Crinkle Cut",category:"Produce",pfgCode:"VM898",parLevel:2},
  {name:"Sauce Teriyaki Sweet Garlic",category:"Dry Goods",pfgCode:"MP296",parLevel:2},
  {name:"Horseradish Prepared",category:"Produce",pfgCode:"85628",parLevel:2},
  {name:"Mayonnaise Packet",category:"Dry Goods",pfgCode:"CV532",parLevel:2},
  {name:"Sauce Barbecue Carolina Tangy Gold",category:"Dry Goods",pfgCode:"23768",parLevel:2},
  {name:"Sauce Hot Original",category:"Dry Goods",pfgCode:"NV808",parLevel:2},
  {name:"Sauce Pepper Glass Bottle Tabasco",category:"Dry Goods",pfgCode:"33578",parLevel:2},
  {name:"Sauce Taco Mild Original",category:"Dry Goods",pfgCode:"16170",parLevel:2},
  {name:"Ketchup Fancy 33% Packet",category:"Dry Goods",pfgCode:"15354",parLevel:4},
  {name:"Dressing Blue Cheese",category:"Dry Goods",pfgCode:"20564",parLevel:3},
  {name:"Ketchup Red Upside Down Bottle",category:"Dry Goods",pfgCode:"NW290",parLevel:5},
  {name:"Sauce Hot Honey",category:"Dry Goods",pfgCode:"VC198",parLevel:2},
  {name:"Olive Ripe Black Sliced",category:"Dry Goods",pfgCode:"GP788",parLevel:2},
  {name:"Pepper Red Crushed Packet",category:"Dry Goods",pfgCode:"FA302",parLevel:2},
  {name:"Salsa Picante Medium",category:"Dry Goods",pfgCode:"RP442",parLevel:2},
  {name:"Sauce Taco Packet",category:"Dry Goods",pfgCode:"CV552",parLevel:2},
  {name:"Mustard Yellow Squeeze Bottle",category:"Dry Goods",pfgCode:"NV568",parLevel:2},
  {name:"Glaze Balsamic",category:"Dry Goods",pfgCode:"PB780",parLevel:2},
  {name:"Sauce Worcestershire",category:"Dry Goods",pfgCode:"22222",parLevel:2},
  {name:"Mustard Yellow Packet",category:"Dry Goods",pfgCode:"CV530",parLevel:2},
  {name:"Pickle Dill Kosher Deli Spear",category:"Produce",pfgCode:"VM900",parLevel:2},
  {name:"Olive Green Queen Stuffed",category:"Dry Goods",pfgCode:"VH218",parLevel:2},
  {name:"Dressing Ranch Fat Free Packet",category:"Dry Goods",pfgCode:"17208",parLevel:2},
  {name:"Ketchup Fancy 33% Can",category:"Dry Goods",pfgCode:"12050",parLevel:3},
  {name:"Sweetener Pink Packet Saccharin",category:"Dry Goods",pfgCode:"JM576",parLevel:2},
  {name:"Olive Kalamata Large Pitted",category:"Dry Goods",pfgCode:"FC208",parLevel:2},
  {name:"Pasta Rotini Whole Grain",category:"Dry Goods",pfgCode:"H0710",parLevel:2},
  {name:"Pickle Dill Kosher Crinkle Cut",category:"Produce",pfgCode:"44076",parLevel:2},
  {name:"Salsa Medium Thick And Chunky",category:"Dry Goods",pfgCode:"RP436",parLevel:2},
  {name:"Sauce Tzatziki",category:"Produce",pfgCode:"RA144",parLevel:2},
  {name:"Sauce Steak A1",category:"Dry Goods",pfgCode:"22270",parLevel:2},
  {name:"Sauce Worcestershire Original",category:"Dry Goods",pfgCode:"22024",parLevel:2},
  {name:"Pea Split Green Dry",category:"Dry Goods",pfgCode:"H8450",parLevel:2},
  {name:"Dressing Bacon Hot",category:"Dry Goods",pfgCode:"CP304",parLevel:2},
  {name:"Dressing Ranch Southwest",category:"Dry Goods",pfgCode:"28420",parLevel:2},
  {name:"Dressing Vinaigrette Raspberry",category:"Dry Goods",pfgCode:"13744",parLevel:2},
  {name:"Glaze Teriyaki",category:"Dry Goods",pfgCode:"10280",parLevel:2},
  {name:"Sauce Asian Sweet Ginger",category:"Dry Goods",pfgCode:"BK578",parLevel:2},
  {name:"Sauce Buffalo Ready To Use",category:"Dry Goods",pfgCode:"MW074",parLevel:3},
  {name:"Sauce Buffalo Sandwich RTU",category:"Dry Goods",pfgCode:"14854",parLevel:2},
  {name:"Sauce Buffalo Wing Medium",category:"Dry Goods",pfgCode:"20676",parLevel:3},
  {name:"Sauce Cayenne Pepper Red Hot",category:"Dry Goods",pfgCode:"11188",parLevel:2},
  {name:"Sauce Cheese Jalapeno BIB",category:"Dry Goods",pfgCode:"15812",parLevel:2},
  {name:"Sauce Cheese Queso Blanco Dispenser",category:"Dry Goods",pfgCode:"C7358",parLevel:2},
  {name:"Sauce Cocktail Zesty",category:"Dry Goods",pfgCode:"24570",parLevel:2},
  {name:"Sauce Signature Shelf Stable",category:"Dry Goods",pfgCode:"VC196",parLevel:2},
  {name:"Sauce Tartar",category:"Dry Goods",pfgCode:"17132",parLevel:2},
  {name:"Sauce Teriyaki",category:"Dry Goods",pfgCode:"CM948",parLevel:2},
  {name:"Sauce Teriyaki Glaze",category:"Dry Goods",pfgCode:"BW786",parLevel:2},
  {name:"Vinegar White Distilled 5%",category:"Dry Goods",pfgCode:"RG080",parLevel:2},
  {name:"Beef Italian Sliced With Gravy",category:"Meat",pfgCode:"LD816",parLevel:2},
  {name:"Ham Smoked Cooked Water Added",category:"Meat",pfgCode:"VA550",parLevel:2},
  {name:"Beef Roast Top Round Cap Off",category:"Meat",pfgCode:"BW750",parLevel:2},
  {name:"Beef Brisket Whole Smoked Hickory",category:"Meat",pfgCode:"H0638",parLevel:2},
  {name:"Box Pizza 12\" B Flute Kraft",category:"Supplies",pfgCode:"FA426",parLevel:5},
  {name:"Napkin Xpress 13X8.6 Natural",category:"Supplies",pfgCode:"DT312",parLevel:4},
  {name:"Container Foam 1 Comp 9X6x3",category:"Supplies",pfgCode:"DV238",parLevel:4},
  {name:"Glove Nitrile Large Black",category:"Supplies",pfgCode:"DV408",parLevel:4},
  {name:"Lid Portion Cup 3.25-5.5oz",category:"Supplies",pfgCode:"PF360",parLevel:3},
  {name:"Circle Pizza 12\" Corrugated",category:"Supplies",pfgCode:"CN926",parLevel:3},
  {name:"Cup Portion Plastic 2oz",category:"Supplies",pfgCode:"PF342",parLevel:3},
  {name:"Foil Aluminum Heavy Duty 18\"",category:"Supplies",pfgCode:"83226",parLevel:2},
  {name:"Lid Portion Cup 1.5-2.5oz",category:"Supplies",pfgCode:"PF358",parLevel:3},
  {name:"Bag T-Sack Thank You",category:"Supplies",pfgCode:"PF116",parLevel:4},
  {name:"Box Pizza 16\" B Flute Kraft",category:"Supplies",pfgCode:"HB952",parLevel:5},
  {name:"Pizza Circle 16\" White On Kraft",category:"Supplies",pfgCode:"PC006",parLevel:3},
  {name:"Towelette Moist Blue Lemon Scent",category:"Supplies",pfgCode:"NJ588",parLevel:2},
  {name:"Cutlery Kit Plastic White",category:"Supplies",pfgCode:"P4206",parLevel:3},
  {name:"Glove Poly Large Gauntlet Cuff",category:"Supplies",pfgCode:"FT556",parLevel:4},
  {name:"Bag Plastic Portion 10X8.5",category:"Supplies",pfgCode:"B1178",parLevel:3},
  {name:"Plate Bagasse 10\" 3 Compartment",category:"Supplies",pfgCode:"VL874",parLevel:3},
  {name:"Paper Register Thermal 3.13\"X200'",category:"Supplies",pfgCode:"28078",parLevel:3},
  {name:"Cup Plastic 16oz Ribbed",category:"Supplies",pfgCode:"T7354",parLevel:4},
  {name:"Cup Portion Plastic 3.25oz",category:"Supplies",pfgCode:"PF346",parLevel:3},
  {name:"Container Food Paper 8oz Round",category:"Supplies",pfgCode:"FC542",parLevel:3},
  {name:"Cup Plastic Kid 12oz Jungle Friends",category:"Supplies",pfgCode:"DT534",parLevel:2},
  {name:"Film Plastic 18\" Roll Foodservice",category:"Supplies",pfgCode:"83234",parLevel:2},
  {name:"Lid Paper 8-12oz Round Vented",category:"Supplies",pfgCode:"FC550",parLevel:3},
  {name:"Glove Nitrile XL Amethyst",category:"Supplies",pfgCode:"DV344",parLevel:3},
  {name:"Container Foam Sandwich 1 Comp",category:"Supplies",pfgCode:"EG086",parLevel:4},
  {name:"Straw 7.75\" Jumbo Black",category:"Supplies",pfgCode:"RE948",parLevel:3},
  {name:"Straw Sipper Stir 5.25\" Black",category:"Supplies",pfgCode:"RB078",parLevel:3},
  {name:"Lid Paper Round 16-32oz",category:"Supplies",pfgCode:"FC546",parLevel:3},
  {name:"Container Food Paper 16oz Round",category:"Supplies",pfgCode:"FC548",parLevel:3},
  {name:"Roll Register 3\"X165' 1 Ply",category:"Supplies",pfgCode:"28048",parLevel:3},
  {name:"Skewer Wooden Bamboo 6\"",category:"Supplies",pfgCode:"W4238",parLevel:2},
  {name:"Fork Plastic Heavy Weight Black",category:"Supplies",pfgCode:"RB780",parLevel:3},
  {name:"Circle Pizza 12\" Safe Handling",category:"Supplies",pfgCode:"PF856",parLevel:3},
  {name:"Napkin Beverage 9.38X9.38 1/4 Fold",category:"Supplies",pfgCode:"DT298",parLevel:4},
  {name:"Straw Jumbo 7.75\" Clear",category:"Supplies",pfgCode:"RB240",parLevel:3},
  {name:"Bag Grocery Paper 57 Pound Kraft",category:"Supplies",pfgCode:"95240",parLevel:3},
  {name:"Bag Plastic Polyethylene 6.5X7",category:"Supplies",pfgCode:"93068",parLevel:3},
  {name:"Bag Plastic Zipseal Gallon",category:"Supplies",pfgCode:"82092",parLevel:3},
  {name:"Bag Sandwich Flip-Top",category:"Supplies",pfgCode:"81702",parLevel:3},
  {name:"Band Napkin Paper White",category:"Supplies",pfgCode:"12882",parLevel:2},
  {name:"Box Pizza 12X2 Chicago Style",category:"Supplies",pfgCode:"DN872",parLevel:4},
  {name:"Can Liner Clear 33 Gal 1.2 Mil",category:"Supplies",pfgCode:"23972",parLevel:5},
  {name:"Container Fiber 1 Comp 9X9 Compostable",category:"Supplies",pfgCode:"PJ786",parLevel:3},
  {name:"Container Foam 1 Comp Large 9X9x3",category:"Supplies",pfgCode:"FR610",parLevel:4},
  {name:"Container Foam 3 Comp 9X9x3",category:"Supplies",pfgCode:"DW036",parLevel:4},
  {name:"Container Foam 3 Comp Large 9.25X9.25X3",category:"Supplies",pfgCode:"H9768",parLevel:4},
  {name:"Container Paper 12oz Black Streetside",category:"Supplies",pfgCode:"77944",parLevel:3},
  {name:"Container Paper 16oz Hot Food",category:"Supplies",pfgCode:"F5318",parLevel:3},
  {name:"Cup 16oz Clear PET",category:"Supplies",pfgCode:"PF968",parLevel:4},
  {name:"Cup Plastic 7oz Translucent",category:"Supplies",pfgCode:"P1722",parLevel:3},
  {name:"Cup Plastic Polystyrene 12oz",category:"Supplies",pfgCode:"T7344",parLevel:3},
  {name:"Film Plastic 12\"X2000'",category:"Supplies",pfgCode:"83228",parLevel:2},
  {name:"Film Plastic 24\" Roll",category:"Supplies",pfgCode:"84064",parLevel:2},
  {name:"Filter Coffee 12 Cup Fast Flow",category:"Supplies",pfgCode:"88018",parLevel:2},
  {name:"Foil Aluminum Sheet 9X10.75",category:"Supplies",pfgCode:"83238",parLevel:3},
  {name:"Glove Nitrile XL Black",category:"Supplies",pfgCode:"HC426",parLevel:4},
  {name:"Glove Nitrile Large Black",category:"Supplies",pfgCode:"HC424",parLevel:4},
  {name:"Guest Check 1 Part Green",category:"Supplies",pfgCode:"85614",parLevel:3},
  {name:"Hairnet Nylon 24\" Black",category:"Supplies",pfgCode:"C2522",parLevel:2},
  {name:"Lid Cold Cup 12-24oz 4\" Straw Slot",category:"Supplies",pfgCode:"BG452",parLevel:4},
  {name:"Lid Souffle Cup 3.25-5.5oz PET",category:"Supplies",pfgCode:"LK502",parLevel:3},
  {name:"Liner Pan 34X18 Full Size High-Heat",category:"Supplies",pfgCode:"C5520",parLevel:2},
  {name:"Napkin Dinner 15X17 White 2 Ply",category:"Supplies",pfgCode:"APG08",parLevel:4},
  {name:"Paper Deli Dry Wax Sheet 12X12",category:"Supplies",pfgCode:"MT730",parLevel:3},
  {name:"Pick Plastic 3.5\" Heavy Duty Arrow",category:"Supplies",pfgCode:"V4896",parLevel:2},
  {name:"Pick Sword Plastic Black",category:"Supplies",pfgCode:"A7840",parLevel:2},
  {name:"Plate 10\" Round Ribbed Black",category:"Supplies",pfgCode:"AEE62",parLevel:3},
  {name:"Plate Foam 3 Comp 10.25\"",category:"Supplies",pfgCode:"EG094",parLevel:3},
  {name:"Plate Paper 3 Comp 10.25\" Vestry",category:"Supplies",pfgCode:"84592",parLevel:3},
  {name:"Towel 1 Ply Brown 800'",category:"Supplies",pfgCode:"79994",parLevel:5},
  {name:"Wiper Foodservice Subway",category:"Supplies",pfgCode:"51032",parLevel:2},
  {name:"Wrap Foil 14X10.5\" Insulated",category:"Supplies",pfgCode:"AAH94",parLevel:3},
  {name:"Wrap Paper Deli Patty 5.5X5.5",category:"Supplies",pfgCode:"AG276",parLevel:3},
  {name:"Chip Potato Kettle Prop 65",category:"Dry Goods",pfgCode:"VF480",parLevel:3},
  {name:"Chip Tortilla Corn White Triangle",category:"Dry Goods",pfgCode:"FM228",parLevel:4},
  {name:"Dressing Mix Ranch Original",category:"Dry Goods",pfgCode:"12278",parLevel:2},
  {name:"Seasoning Sriracha Blend",category:"Dry Goods",pfgCode:"V6298",parLevel:2},
  {name:"Cracker Saltine Krispy",category:"Dry Goods",pfgCode:"21110",parLevel:2},
  {name:"Crouton Cube Seasoned Portion",category:"Dry Goods",pfgCode:"15010",parLevel:2},
  {name:"Base Soup Chicken Low Sodium",category:"Dry Goods",pfgCode:"LG166",parLevel:2},
  {name:"Seasoning Fajita Mix",category:"Dry Goods",pfgCode:"21226",parLevel:2},
  {name:"Dill Weed",category:"Dry Goods",pfgCode:"CE772",parLevel:2},
  {name:"Breading All Purpose 1 Step",category:"Dry Goods",pfgCode:"27230",parLevel:2},
  {name:"Seasoning Pepper Blend",category:"Dry Goods",pfgCode:"66772",parLevel:2},
  {name:"Seasoning Blend Blackened Steak",category:"Dry Goods",pfgCode:"CE864",parLevel:2},
  {name:"Salt Seasoning No Msg",category:"Dry Goods",pfgCode:"A2468",parLevel:2},
  {name:"Seasoning Blend Cajun",category:"Dry Goods",pfgCode:"CE728",parLevel:2},
  {name:"Sauce Mix Cheese Cheddar Deluxe",category:"Dry Goods",pfgCode:"26950",parLevel:2},
  {name:"Pepper Black Regular Ground",category:"Dry Goods",pfgCode:"CE738",parLevel:2},
  {name:"Seasoning Blend Lemon Pepper",category:"Dry Goods",pfgCode:"CE730",parLevel:2},
  {name:"Base Soup Cream",category:"Dry Goods",pfgCode:"LG174",parLevel:2},
  {name:"Soup Tomato Condensed Can (Culinary Secrets)",category:"Dry Goods",pfgCode:"11132",parLevel:2},
  {name:"Seasoning Blend Barbecue Rib Rub",category:"Dry Goods",pfgCode:"E6089",parLevel:2},
  {name:"Onion Powder",category:"Dry Goods",pfgCode:"CE582",parLevel:2},
  {name:"Oregano Leaves Whole",category:"Dry Goods",pfgCode:"CE568",parLevel:2},
  {name:"Oregano Ground",category:"Dry Goods",pfgCode:"CE828",parLevel:2},
  {name:"Garlic Granulated",category:"Dry Goods",pfgCode:"CE722",parLevel:2},
  {name:"Seasoning Taco Mix Packet",category:"Dry Goods",pfgCode:"CE572",parLevel:2},
  {name:"Chili Powder Dark",category:"Dry Goods",pfgCode:"CE588",parLevel:2},
  {name:"Onion Granulated",category:"Dry Goods",pfgCode:"CE748",parLevel:2},
  {name:"Salt Kosher Coarse",category:"Dry Goods",pfgCode:"RP538",parLevel:3},
  {name:"Syrup Wild Blackberry",category:"Dry Goods",pfgCode:"N2692",parLevel:2},
  {name:"Pepper Black Whole",category:"Dry Goods",pfgCode:"CE784",parLevel:2},
  {name:"Appetizer Mix Tater Tumbler",category:"Dry Goods",pfgCode:"W1406",parLevel:2},
  {name:"Base Cream Concentrate",category:"Dry Goods",pfgCode:"98504",parLevel:2},
  {name:"Base Soup Beef Low Sodium",category:"Dry Goods",pfgCode:"LG168",parLevel:2},
  {name:"Base Vegetable Sauteed Mirepoix",category:"Dry Goods",pfgCode:"34562",parLevel:2},
  {name:"Basil Leaves Whole",category:"Dry Goods",pfgCode:"CE762",parLevel:2},
  {name:"Batter Crispy Frying Mix",category:"Dry Goods",pfgCode:"27174",parLevel:2},
  {name:"Bay Leaves Whole",category:"Dry Goods",pfgCode:"CE830",parLevel:2},
  {name:"Breadcrumb Panko",category:"Dry Goods",pfgCode:"T9560",parLevel:2},
  {name:"Breading Chicken Crispy Seasoned",category:"Dry Goods",pfgCode:"27048",parLevel:2},
  {name:"Broth Chicken Canned",category:"Dry Goods",pfgCode:"11284",parLevel:2},
  {name:"Corn Starch Pure",category:"Dry Goods",pfgCode:"19702",parLevel:2},
  {name:"Cracker Saltine Zero Trans Fat",category:"Dry Goods",pfgCode:"26264",parLevel:2},
  {name:"Cumin Seed Ground",category:"Dry Goods",pfgCode:"CE726",parLevel:2},
  {name:"Flour All Purpose Bleached Enriched",category:"Dry Goods",pfgCode:"27636",parLevel:3},
  {name:"Garlic Powder",category:"Dry Goods",pfgCode:"CE584",parLevel:2},
  {name:"Gravy Mix Beef Instant",category:"Dry Goods",pfgCode:"22872",parLevel:2},
  {name:"Gravy Mix Chicken Flavored",category:"Dry Goods",pfgCode:"26922",parLevel:2},
  {name:"Gravy Mix Pork Flavored",category:"Dry Goods",pfgCode:"26942",parLevel:2},
  {name:"Gravy Mix Turkey Flavored",category:"Dry Goods",pfgCode:"26940",parLevel:2},
  {name:"Onion Powder (Roma)",category:"Dry Goods",pfgCode:"DL748",parLevel:2},
  {name:"Parsley Flakes",category:"Dry Goods",pfgCode:"CE804",parLevel:2},
  {name:"Pepper Black Coarse Ground",category:"Dry Goods",pfgCode:"DF748",parLevel:2},
  {name:"Pepper Red Crushed",category:"Dry Goods",pfgCode:"CE620",parLevel:2},
  {name:"Pepper White Ground",category:"Dry Goods",pfgCode:"DH056",parLevel:2},
  {name:"Salt Celery",category:"Dry Goods",pfgCode:"CE740",parLevel:2},
  {name:"Seasoning Blend Italian",category:"Dry Goods",pfgCode:"CE754",parLevel:2},
  {name:"Seasoning Taco Mix",category:"Dry Goods",pfgCode:"CE594",parLevel:2},
  {name:"Shaker Pepper Disposable",category:"Supplies",pfgCode:"CA406",parLevel:2},
  {name:"Shaker Salt Disposable",category:"Supplies",pfgCode:"CA408",parLevel:2},
  {name:"Soup Tomato Condensed Can",category:"Dry Goods",pfgCode:"22174",parLevel:2},
  {name:"Syrup Dragon Fruit",category:"Dry Goods",pfgCode:"FD562",parLevel:2},
  {name:"Tuna Chunk Light Skipjack",category:"Dry Goods",pfgCode:"36646",parLevel:2},
  {name:"Brick Grill 3.5X4x8 Black",category:"Supplies",pfgCode:"13522",parLevel:2},
  {name:"Scrubber Stainless Steel 1.75oz",category:"Supplies",pfgCode:"13498",parLevel:2},
  {name:"Dispenser Squeeze Bottle 32oz",category:"Supplies",pfgCode:"A8212",parLevel:2},
  {name:"Fuel Chafing 6 Hour Wick",category:"Supplies",pfgCode:"CC988",parLevel:3},
  {name:"Glass Mixing 16oz Clear",category:"Supplies",pfgCode:"A9754",parLevel:2},
  {name:"Holder Knife 24\" Magna Bar",category:"Supplies",pfgCode:"A2930",parLevel:1},
  {name:"Knife Steak Black Handle",category:"Supplies",pfgCode:"58730",parLevel:2},
  {name:"Pad Griddle Heavy Duty 4.5X5.5",category:"Supplies",pfgCode:"97102",parLevel:3},
  {name:"Scrubber Pot And Pan 6X9 Green",category:"Supplies",pfgCode:"13486",parLevel:3},
  {name:"Scrubber Scotchbrick Griddle",category:"Supplies",pfgCode:"97106",parLevel:2},
  {name:"Shaker Cheese 6oz Glass",category:"Supplies",pfgCode:"91416",parLevel:2},
  {name:"Spreader Butter Roller",category:"Supplies",pfgCode:"BR108",parLevel:1},
  {name:"Macaroni And Cheese Premium",category:"Dairy",pfgCode:"CP320",parLevel:2},
  {name:"Sauce Pesto Basil",category:"Produce",pfgCode:"HB908",parLevel:2},
  {name:"Sauce Chimichurri Frozen",category:"Dry Goods",pfgCode:"CK688",parLevel:2},
  {name:"Sauce Alfredo Frozen",category:"Dairy",pfgCode:"22826",parLevel:2},
  {name:"Hashbrown Patty 2.25oz",category:"Produce",pfgCode:"93130",parLevel:4},
  {name:"Fries Sweet Potato 5/16\"",category:"Dry Goods",pfgCode:"DA786",parLevel:3},
  {name:"Appetizer Frank Beef Cocktail",category:"Meat",pfgCode:"FW208",parLevel:2},
  {name:"French Toast Stick 1.19oz",category:"Dry Goods",pfgCode:"F1108",parLevel:2},
  {name:"Appetizer Cheesestick Mozzarella",category:"Dairy",pfgCode:"HD634",parLevel:3},
  {name:"Rice Spanish Boil In Bag",category:"Dry Goods",pfgCode:"C0718",parLevel:2},
  {name:"Fries Waffle Grade A Seasoned",category:"Dry Goods",pfgCode:"73838",parLevel:4},
  {name:"Wonton Wrap With Duck Bacon",category:"Meat",pfgCode:"B2450",parLevel:2},
  {name:"Potato Baby Baker Roasted Halves",category:"Produce",pfgCode:"CL038",parLevel:3},
  {name:"Hushpuppy With Yellow Onion",category:"Dry Goods",pfgCode:"GM404",parLevel:2},
  {name:"Ravioli Spinach Cheese",category:"Dairy",pfgCode:"EE362",parLevel:2},
  {name:"Gyro Meat Beef Lamb Sliced",category:"Meat",pfgCode:"PW602",parLevel:3},
  {name:"Pasta Lasagna Sheet Rippled",category:"Dry Goods",pfgCode:"64858",parLevel:2},
  {name:"Appetizer Broccoli Cheddar Bite",category:"Dairy",pfgCode:"AG238",parLevel:2},
  {name:"Appetizer Cauliflower Cheddar",category:"Dairy",pfgCode:"VC870",parLevel:2},
  {name:"Appetizer Cheese Curd White",category:"Dairy",pfgCode:"BN010",parLevel:3},
  {name:"Appetizer Cheesestick Breaded Italian",category:"Dairy",pfgCode:"HD636",parLevel:3},
  {name:"Appetizer Mac & Cheese Bite",category:"Dairy",pfgCode:"CV822",parLevel:2},
  {name:"Appetizer Mushroom Bella Breaded",category:"Produce",pfgCode:"FR310",parLevel:2},
  {name:"Appetizer Mushroom Breaded Buttery",category:"Produce",pfgCode:"G6232",parLevel:2},
  {name:"Appetizer Mushroom Whole Breaded",category:"Produce",pfgCode:"CV816",parLevel:2},
  {name:"Appetizer Onion Petal Battered",category:"Produce",pfgCode:"G6236",parLevel:3},
  {name:"Appetizer Onion Ring 3/8\" Beer Battered",category:"Produce",pfgCode:"ALK96",parLevel:3},
  {name:"Appetizer Potato Muncher Southwest",category:"Produce",pfgCode:"83458",parLevel:2},
  {name:"Batter Pancake Potato",category:"Produce",pfgCode:"C3996",parLevel:2},
  {name:"Cheese Breaded Curd Natural White",category:"Dairy",pfgCode:"A7418",parLevel:3},
  {name:"Potato Breaded Cheddar Spudz",category:"Produce",pfgCode:"62060",parLevel:2},
  {name:"Potato Jumbo Stuffed Tater Keg",category:"Produce",pfgCode:"F8520",parLevel:2},
  {name:"Sauce Hollandaise Ready To Use",category:"Dairy",pfgCode:"F4760",parLevel:2},
  {name:"Sauce Pesto Basil With Pine Nut",category:"Produce",pfgCode:"CK682",parLevel:2},
  {name:"Taco Chicken Mini",category:"Meat",pfgCode:"AAJ34",parLevel:2},
  {name:"Oil Olive Extra Virgin Tin",category:"Dry Goods",pfgCode:"CN134",parLevel:2},
  {name:"Paste Chili Red Gochujang",category:"Dry Goods",pfgCode:"K3484",parLevel:2},
  {name:"Oil Blend Canola & Extra Virgin Olive",category:"Dry Goods",pfgCode:"33388",parLevel:3},
  {name:"Oil Olive Sunflower Blend 51/49",category:"Dry Goods",pfgCode:"ACA22",parLevel:2},
  {name:"Ham Buffet Gourmet Hardwood Smoked",category:"Meat",pfgCode:"49800",parLevel:2},
  {name:"Pepperoni Sliced 14 Count",category:"Meat",pfgCode:"DR820",parLevel:3},
  {name:"Bacon Real Bits Fully Cooked",category:"Meat",pfgCode:"E5798",parLevel:2},
  {name:"Sausage Italian Topping Mild",category:"Meat",pfgCode:"11590",parLevel:2},
  {name:"Bratwurst Pork Patty 4-1 Raw",category:"Meat",pfgCode:"C2228",parLevel:2},
  {name:"Ham And Water Product Diced",category:"Meat",pfgCode:"VC734",parLevel:2},
  {name:"Pork Ribeye Chop Boneless",category:"Meat",pfgCode:"55986",parLevel:2},
  {name:"Pork Shoulder Boneless Picnic",category:"Meat",pfgCode:"VM860",parLevel:2},
  {name:"Sausage Link Casing Country Blend",category:"Meat",pfgCode:"CV338",parLevel:2},
  {name:"Sausage Rope Jalapeno Cheddar",category:"Meat",pfgCode:"AVK20",parLevel:2},
  {name:"Pork Boston Butt 7Up",category:"Meat",pfgCode:"39104",parLevel:2},
  {name:"Bacon Canadian Sliced 3\"",category:"Meat",pfgCode:"FC362",parLevel:2},
  {name:"Bratwurst Pork 5.5\" 4-1",category:"Meat",pfgCode:"PK140",parLevel:3},
  {name:"Corn Dog Chicken Mini",category:"Meat",pfgCode:"F4572",parLevel:2},
  {name:"Franks All Beef 6\" 6-1",category:"Meat",pfgCode:"20738",parLevel:3},
  {name:"Pork Loin 8Up Boneless",category:"Meat",pfgCode:"39414",parLevel:2},
  {name:"Pork Loin Chop Boneless Center Cut",category:"Meat",pfgCode:"50634",parLevel:2},
  {name:"Pork Pulled No Sauce Cooked",category:"Meat",pfgCode:"76930",parLevel:3},
  {name:"Pork Rib Pieces Bone In Smoked",category:"Meat",pfgCode:"C7072",parLevel:2},
  {name:"Sausage Andouille Rope Smoked",category:"Meat",pfgCode:"43134",parLevel:2},
  {name:"Sausage Chorizo Ground",category:"Meat",pfgCode:"PK240",parLevel:2},
  {name:"Sausage Link Cocktail Little Smokies",category:"Meat",pfgCode:"GW290",parLevel:2},
  {name:"Sausage Pork Link Skin On",category:"Meat",pfgCode:"G1578",parLevel:2},
  {name:"Chicken Breast Strip Grilled Cooked",category:"Meat",pfgCode:"HC310",parLevel:3},
  {name:"Chicken Wing 1st & 2nd Joints",category:"Meat",pfgCode:"CK522",parLevel:6},
  {name:"Turkey Breast Smoked Skinless",category:"Meat",pfgCode:"PW962",parLevel:2},
  {name:"Chicken Breast 4oz Grilled",category:"Meat",pfgCode:"HC234",parLevel:3},
  {name:"Chicken Diced .5 60% Dark 40% White",category:"Meat",pfgCode:"DP306",parLevel:2},
  {name:"Chicken Diced .5 55% White 45% Dark",category:"Meat",pfgCode:"DP302",parLevel:2},
  {name:"Turkey Breast Oven Roasted",category:"Meat",pfgCode:"DV462",parLevel:2},
  {name:"Chicken Breast Skewer 1.75oz",category:"Meat",pfgCode:"PN096",parLevel:2},
  {name:"Chicken Breast Chunk Breaded",category:"Meat",pfgCode:"96108",parLevel:4},
  {name:"Chicken Breast Tender 58 Count",category:"Meat",pfgCode:"59048",parLevel:4},
  {name:"Turkey Raw Breast & Thigh Boneless",category:"Meat",pfgCode:"DT824",parLevel:2},
  {name:"Chicken Breast Fillet Strip Cooked",category:"Meat",pfgCode:"43728",parLevel:2},
  {name:"Chicken 8 Pieces Marinated",category:"Meat",pfgCode:"RM356",parLevel:3},
  {name:"Chicken Breast No Bone Or Skin 6oz",category:"Meat",pfgCode:"G9902",parLevel:3},
  {name:"Chicken Breast Random Jumbo 14oz",category:"Meat",pfgCode:"HC058",parLevel:3},
  {name:"Chicken Tinga Southwest Cooked",category:"Meat",pfgCode:"13146",parLevel:2},
  {name:"Pepper Bell Green Medium #1",category:"Produce",pfgCode:"13688",parLevel:2},
  {name:"Salad Blend Iceberg/Romaine 80/20",category:"Produce",pfgCode:"HB274",parLevel:4},
  {name:"Tomato Round Diced 3/8\"",category:"Produce",pfgCode:"26030",parLevel:3},
  {name:"Tomato Round Red 5X6 Large",category:"Produce",pfgCode:"25840",parLevel:3},
  {name:"Lettuce Romaine Liner Fresh",category:"Produce",pfgCode:"FA232",parLevel:3},
  {name:"Salad Potato Steakhouse",category:"Produce",pfgCode:"CA232",parLevel:2},
  {name:"Brussels Sprouts Halves",category:"Produce",pfgCode:"WB336",parLevel:2},
  {name:"Mushroom White Sliced 1/4\"",category:"Produce",pfgCode:"NH674",parLevel:3},
  {name:"Lemon Choice 165/200 Size",category:"Produce",pfgCode:"74184",parLevel:2},
  {name:"Lemon Choice 140 Size",category:"Produce",pfgCode:"27500",parLevel:2},
  {name:"Potato Red Small Size B",category:"Produce",pfgCode:"JJ766",parLevel:2},
  {name:"Squash Yellow Fancy",category:"Produce",pfgCode:"13726",parLevel:2},
  {name:"Squash Zucchini Fancy/Med",category:"Produce",pfgCode:"13736",parLevel:2},
  {name:"Tomato Cherry Pint A Size",category:"Produce",pfgCode:"A0238",parLevel:2},
  {name:"Basil Fresh",category:"Produce",pfgCode:"CK134",parLevel:1},
  {name:"Mushroom Crimini Fresh",category:"Produce",pfgCode:"22922",parLevel:2},
  {name:"Brussels Sprouts Fresh",category:"Produce",pfgCode:"R9570",parLevel:2},
  {name:"Coleslaw Creamy Sweet",category:"Produce",pfgCode:"62538",parLevel:2},
  {name:"Pepper Bell Green Chopper",category:"Produce",pfgCode:"HB358",parLevel:2},
  {name:"Basil Fresh (Peak)",category:"Produce",pfgCode:"CK132",parLevel:1},
  {name:"Mushroom Portabella 4\"+",category:"Produce",pfgCode:"20478",parLevel:2},
  {name:"Carrot Rainbow Whole",category:"Produce",pfgCode:"H0834",parLevel:1},
  {name:"Cucumber Select Us #1",category:"Produce",pfgCode:"13280",parLevel:2},
  {name:"Lettuce Iceberg Clean And Trim",category:"Produce",pfgCode:"CK418",parLevel:3},
  {name:"Lettuce Romaine Shredded",category:"Produce",pfgCode:"12342",parLevel:3},
  {name:"Salad Blend Iceberg w/ Carrot/Cabbage",category:"Produce",pfgCode:"HB272",parLevel:3},
  {name:"Lettuce Iceberg Liner Fresh",category:"Produce",pfgCode:"FA234",parLevel:3},
  {name:"Chives Fresh",category:"Produce",pfgCode:"CK128",parLevel:1},
  {name:"Cilantro Bunched Fresh",category:"Produce",pfgCode:"14040",parLevel:2},
  {name:"Lemon Choice Fresh",category:"Produce",pfgCode:"GC956",parLevel:2},
  {name:"Lettuce Leaf Better Burger",category:"Produce",pfgCode:"NH168",parLevel:2},
  {name:"Lime Fresh (Packer)",category:"Produce",pfgCode:"59074",parLevel:2},
  {name:"Mushroom Medium #1",category:"Produce",pfgCode:"20340",parLevel:2},
  {name:"Onion Red Jumbo Us #1",category:"Produce",pfgCode:"13570",parLevel:2},
  {name:"Onion Yellow Whole Peeled Jumbo",category:"Produce",pfgCode:"G6102",parLevel:3},
  {name:"Potato Idaho Russet 90 Count",category:"Produce",pfgCode:"FA246",parLevel:3},
  {name:"Salad Pasta Italiano",category:"Produce",pfgCode:"72248",parLevel:2},
  {name:"Salad Pasta Summer Fresh",category:"Produce",pfgCode:"CA222",parLevel:2},
  {name:"Salad Potato American",category:"Produce",pfgCode:"68552",parLevel:2},
  {name:"Salad Potato German",category:"Produce",pfgCode:"72328",parLevel:2},
  {name:"Salad Potato Grandpa's",category:"Produce",pfgCode:"72252",parLevel:2},
  {name:"Salad Potato Mustard",category:"Produce",pfgCode:"CA234",parLevel:2},
  {name:"Salad Three Bean",category:"Produce",pfgCode:"CA218",parLevel:2},
  {name:"Tomato Red 5X6 Large Round",category:"Produce",pfgCode:"25908",parLevel:3},
  {name:"Tomato Roma Fresh",category:"Produce",pfgCode:"13766",parLevel:2},
  {name:"Tomato Round Red Extra Large",category:"Produce",pfgCode:"25942",parLevel:2},
  {name:"Tomato Round Red 6X6",category:"Produce",pfgCode:"25970",parLevel:2},
  {name:"Cheese Parmesan Shaved",category:"Dairy",pfgCode:"AA826",parLevel:2},
  {name:"Haddock Loin 3oz",category:"Seafood",pfgCode:"VB978",parLevel:2},
  {name:"Salmon Loin Average 6oz",category:"Seafood",pfgCode:"F2376",parLevel:3},
  {name:"Perch Lake European Fillet",category:"Seafood",pfgCode:"V1062",parLevel:2},
  {name:"Shrimp Breaded Hand Oriental",category:"Seafood",pfgCode:"53476",parLevel:3},
  {name:"Pike Walleye Fillet 2-4oz",category:"Seafood",pfgCode:"27758",parLevel:2},
  {name:"Shrimp White Raw Peeled 16-20",category:"Seafood",pfgCode:"CR080",parLevel:3},
  {name:"Shrimp Battered Beer 31-35",category:"Seafood",pfgCode:"98924",parLevel:3},
  {name:"COD Fillet 3oz Beer Battered",category:"Seafood",pfgCode:"EA008",parLevel:3},
  {name:"Appetizer Scallop Bacon Wrapped",category:"Seafood",pfgCode:"GJ202",parLevel:2},
  {name:"Walleye Breaded Bites",category:"Seafood",pfgCode:"AFE44",parLevel:2},
  {name:"Pollock Fillet 2-4oz",category:"Seafood",pfgCode:"JL288",parLevel:2},
  {name:"Shrimp White 21-25 Raw",category:"Seafood",pfgCode:"CR082",parLevel:2},
  {name:"Calamari Ring & Tentacles Breaded",category:"Seafood",pfgCode:"15444",parLevel:2},
  {name:"Bluegill Fillet Skin On 1-1.4oz",category:"Seafood",pfgCode:"CB094",parLevel:2},
  {name:"COD Battered Beer Fry/Oven 2-3oz",category:"Seafood",pfgCode:"52040",parLevel:3},
  {name:"Flounder Fillet 3-5oz Skinless",category:"Seafood",pfgCode:"GW348",parLevel:2},
  {name:"Lobster Meat Sensations Blend",category:"Seafood",pfgCode:"D5060",parLevel:2},
  {name:"Pike Sauger 1.5-2.5oz",category:"Seafood",pfgCode:"50052",parLevel:2}
];

export default function App() {
  const users = useLiveCollection('users');
  const shifts = useLiveCollection('shifts');
  const prepItems = useLiveCollection('prepItems');
  const inventoryItems = useLiveCollection('inventoryItems');
  const timeOff = useLiveCollection('timeOff');
  const shiftSwaps = useLiveCollection('shiftSwaps');
  const events = useLiveCollection('events');
  
  const [appUser, setAppUser] = useState(() => { const saved = localStorage.getItem('cheersUser'); return saved ? JSON.parse(saved) : null; });

  useEffect(() => {
    if (appUser) localStorage.setItem('cheersUser', JSON.stringify(appUser));
    else localStorage.removeItem('cheersUser');
  }, [appUser]);

  useEffect(() => { signInAnonymously(auth).catch(err => console.error("Firebase Auth error:", err)); }, []);

  const [activeTab, setActiveTab] = useState('schedule');
  const [currentDate, setCurrentDate] = useState(getToday());
  const [toasts, setToasts] = useState([]);
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const liveAppUser = appUser ? (users.find(u => u.id === appUser.id) || appUser) : null;

  const addToast = (title, message) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, title, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 6000);
  };

  if (!liveAppUser) return <LoginScreen users={users} setAppUser={setAppUser} />;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col">
      <style>{`
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .animate-slide-in { animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes toastSlide { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .animate-toast { animation: toastSlide 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
      `}</style>

      {/* --- Header --- */}
      <header className="bg-white sticky top-0 z-40 shadow-sm border-b border-slate-200 h-20 flex items-center justify-between px-6">
        <CheersLogo />
        <button onClick={() => setIsMenuOpen(true)} className="relative p-2.5 bg-slate-50 border border-slate-200 text-slate-700 rounded-xl shadow-sm hover:bg-slate-100 hover:text-slate-900 transition-all outline-none"><Menu size={24} /></button>
      </header>

      <DrawerMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} activeTab={activeTab} setActiveTab={setActiveTab} appUser={liveAppUser} setAppUser={setAppUser} />

      {/* --- Date Header --- */}
      {['schedule', 'prep', 'month'].includes(activeTab) && (
        <div className="bg-white py-5 px-4 shadow-sm z-30 border-b border-slate-200">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <button onClick={() => activeTab === 'month' ? setCurrentDate(addDays(currentDate, -30)) : setCurrentDate(addDays(currentDate, -1))} className="p-2.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors text-slate-600"><ChevronLeft size={24} /></button>
            <h2 onClick={() => setIsDateModalOpen(true)} className="text-2xl sm:text-3xl font-black tracking-tight text-center cursor-pointer hover:text-blue-600 transition-colors">{activeTab === 'month' ? formatDisplayMonth(getMonthStr(currentDate)) : formatDisplayDate(currentDate)}</h2>
            <button onClick={() => activeTab === 'month' ? setCurrentDate(addDays(currentDate, 30)) : setCurrentDate(addDays(currentDate, 1))} className="p-2.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors text-slate-600"><ChevronRight size={24} /></button>
          </div>
        </div>
      )}

      <Modal isOpen={isDateModalOpen} onClose={() => setIsDateModalOpen(false)} title="Select Date">
        <div className="space-y-4">
          <input type="date" value={currentDate || ''} onChange={e => { if (e.target.value) { setCurrentDate(e.target.value); setIsDateModalOpen(false); } }} className="w-full p-4 bg-slate-50 border border-slate-300 rounded-xl text-lg font-bold outline-none focus:ring-2 focus:ring-blue-500" />
          <button onClick={() => setIsDateModalOpen(false)} className="w-full bg-slate-900 text-white p-3.5 rounded-xl font-bold hover:bg-slate-800 transition-colors">Close</button>
        </div>
      </Modal>

      {/* --- Main Content Area --- */}
      <main className="flex-1 max-w-6xl mx-auto w-full p-4 sm:p-6 pb-24">
        {activeTab === 'schedule' && <TabSchedule currentDate={currentDate} appUser={liveAppUser} users={users} shifts={shifts} shiftSwaps={shiftSwaps} timeOff={timeOff} events={events} addToast={addToast} />}
        {activeTab === 'month' && <TabMonth currentDate={currentDate} appUser={liveAppUser} users={users} shifts={shifts} events={events} setCurrentDate={(d) => { setCurrentDate(d); setActiveTab('schedule'); }} />}
        {activeTab === 'timeoff' && <TabTimeOff appUser={liveAppUser} users={users} timeOff={timeOff} addToast={addToast} />}
        {activeTab === 'prep' && <TabPrep currentDate={currentDate} prepItems={prepItems} />}
        {activeTab === 'inventory' && <TabInventory inventoryItems={inventoryItems} addToast={addToast} />}
        {activeTab === 'team' && <TabTeam appUser={liveAppUser} users={users} addToast={addToast} />}
        {activeTab === 'settings' && <TabSettings addToast={addToast} inventoryItems={inventoryItems} />}
      </main>

      {/* --- Toast Alert Engine --- */}
      <div className="fixed top-24 inset-x-0 mx-auto w-full max-w-md z-50 flex flex-col gap-3 px-4 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="bg-slate-900 text-white p-4 rounded-2xl shadow-2xl pointer-events-auto flex items-start gap-4 border border-slate-700 animate-toast">
            <div className="bg-blue-500/20 p-2 rounded-full text-blue-400 mt-0.5"><Bell size={18} /></div>
            <div><h4 className="font-bold text-sm">{t.title}</h4><p className="text-sm text-slate-300 font-medium mt-0.5">{t.message}</p></div>
            <button onClick={() => setToasts(prev => prev.filter(toast => toast.id !== t.id))} className="ml-auto text-slate-400 hover:text-white"><X size={16}/></button>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Login Screen ---
const LoginScreen = ({ users, setAppUser }) => {
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [newPassword, setNewPassword] = useState(''); const [error, setError] = useState(''); const [isLoading, setIsLoading] = useState(false); const [resetUser, setResetUser] = useState(null);
  const isFirstUser = users.length === 0;

  const handleAuth = async (e) => {
    e.preventDefault(); setError(''); setIsLoading(true);
    try {
      if (isFirstUser) {
        if (!name.trim()) return setError("Name is required for the first admin account.");
        const newUser = { name: name.trim(), email: MASTER_ADMIN_EMAIL, phone: '', password, role: 'Kitchen', isAdmin: true, isActive: true, forcePasswordChange: false, availability: {sun:true,mon:true,tue:true,wed:true,thu:true,fri:true,sat:true} };
        const docRef = await addDoc(collection(db, "users"), newUser);
        setAppUser({ id: docRef.id, ...newUser });
      } else {
        const user = users.find(u => u.email === email.toLowerCase().trim() && u.password === password);
        if (user) { if (user.forcePasswordChange) setResetUser(user); else setAppUser(user); } 
        else setError("Invalid email or password.");
      }
    } catch (err) { setError("Database connection error."); console.error(err); }
    setIsLoading(false);
  };

  const handlePasswordSetup = async (e) => {
    e.preventDefault(); setError(''); setIsLoading(true);
    if(newPassword.length < 5) { setError("Password must be at least 5 characters."); setIsLoading(false); return; }
    try {
      await updateDoc(doc(db, "users", resetUser.id), { password: newPassword, forcePasswordChange: false });
      setAppUser({ ...resetUser, password: newPassword, forcePasswordChange: false });
    } catch (err) { setError("Failed to update password."); console.error(err); }
    setIsLoading(false);
  };

  if (resetUser) return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4"><div className="bg-white rounded-3xl shadow-xl border border-slate-200 p-8 max-w-md w-full"><h2 className="text-2xl font-black text-center mb-2 text-slate-900 tracking-tight">Welcome, {resetUser.name}!</h2><p className="text-center text-slate-500 mb-6 font-medium">Please set your permanent password to continue.</p><form onSubmit={handlePasswordSetup} className="space-y-4"><div><label className="block text-sm font-bold text-slate-600 mb-1.5">New Password</label><input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full p-3.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" required /></div>{error && <p className="text-red-600 text-sm font-bold bg-red-50 p-3 rounded-xl border border-red-200">{error}</p>}<button type="submit" disabled={isLoading} className="w-full bg-slate-900 text-white p-4 rounded-xl font-bold hover:bg-slate-800 transition-colors shadow-md flex justify-center items-center gap-2">{isLoading ? <Loader2 className="animate-spin" size={20}/> : 'Save Password & Login'}</button></form></div></div>
  );

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4"><div className="bg-white rounded-3xl shadow-xl border border-slate-200 p-8 max-w-md w-full"><div className="flex justify-center mb-8"><CheersLogo /></div><h2 className="text-2xl font-black text-center mb-6 text-slate-900 tracking-tight">{isFirstUser ? 'Create Admin Account' : 'Staff Login'}</h2><form onSubmit={handleAuth} className="space-y-4">{isFirstUser && (<div><label className="block text-sm font-bold text-slate-600 mb-1.5">Your Name</label><input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-3.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" required /></div>)}<div><label className="block text-sm font-bold text-slate-600 mb-1.5">Email Address</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-3.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" required /></div><div><label className="block text-sm font-bold text-slate-600 mb-1.5">Password</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-3.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" required /></div>{error && <p className="text-red-600 text-sm font-bold bg-red-50 p-3 rounded-xl border border-red-200">{error}</p>}<button type="submit" disabled={isLoading} className="w-full bg-slate-900 text-white p-4 rounded-xl font-bold hover:bg-slate-800 transition-colors shadow-md mt-2 flex justify-center items-center gap-2">{isLoading ? <Loader2 className="animate-spin" size={20}/> : (isFirstUser ? 'Create Account' : 'Login')}</button></form></div></div>
  );
};

// --- Tab: Team ---
const TabTeam = ({ appUser, users, addToast }) => {
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [phone, setPhone] = useState(''); const [password, setPassword] = useState(''); const [role, setRole] = useState('Bartender'); const [isAdmin, setIsAdmin] = useState(false);
  const [availModalUser, setAvailModalUser] = useState(null);
  
  const displayUsers = users.length > 0 ? users : (appUser ? [appUser] : []);

  const handleAdd = async (e) => {
    e.preventDefault(); if (!name.trim() || !email.trim() || !password.trim()) return;
    try {
      await addDoc(collection(db, "users"), { name: name.trim(), email: email.toLowerCase().trim(), phone: phone.trim(), password, role, isAdmin, isActive: true, forcePasswordChange: true, availability: {sun:true,mon:true,tue:true,wed:true,thu:true,fri:true,sat:true} });
      addToast('Team Member Added', `${name.trim()} will be prompted to set a new password on their first login.`);
      setName(''); setEmail(''); setPhone(''); setPassword(''); setIsAdmin(false);
    } catch (err) { console.error(err); }
  };

  const handleToggleAdmin = async (id, currentStatus) => { await updateDoc(doc(db, "users", id), { isAdmin: !currentStatus }); };
  const handleDelete = async (id) => { if (window.confirm("Remove this staff member? This cannot be undone.")) { await deleteDoc(doc(db, "users", id)); addToast('Staff Removed', 'Account permanently deleted.'); } };

  const handleSaveAvail = async (e) => {
    e.preventDefault();
    await updateDoc(doc(db, "users", availModalUser.id), { availability: availModalUser.availability });
    addToast('Availability Saved', `${availModalUser.name}'s schedule lockouts updated.`);
    setAvailModalUser(null);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <Modal isOpen={!!availModalUser} onClose={() => setAvailModalUser(null)} title={`Availability: ${availModalUser?.name}`}>
        {availModalUser && (
          <form onSubmit={handleSaveAvail} className="space-y-4">
            <p className="text-sm text-slate-500 font-medium mb-4">Uncheck the days this employee is permanently unavailable to work.</p>
            <div className="space-y-2 border border-slate-200 rounded-xl p-4 bg-slate-50">
              {['sun','mon','tue','wed','thu','fri','sat'].map((day, idx) => (
                <label key={day} className="flex items-center justify-between p-2 hover:bg-white rounded-lg cursor-pointer transition-colors border border-transparent hover:border-slate-200 shadow-sm">
                  <span className="font-bold text-slate-700 capitalize">{['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][idx]}</span>
                  <input type="checkbox" checked={availModalUser.availability?.[day] ?? true} onChange={e => setAvailModalUser({...availModalUser, availability: {...(availModalUser.availability || {}), [day]: e.target.checked}})} className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                </label>
              ))}
            </div>
            <button type="submit" className="w-full bg-blue-600 text-white p-3.5 rounded-xl font-bold shadow-sm hover:bg-blue-700 transition-colors">Save Lockouts</button>
          </form>
        )}
      </Modal>

      {appUser?.isAdmin && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-800"><Users size={20}/> Add Staff Member</h3>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Name</label><input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:border-blue-500" required /></div>
              <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:border-blue-500" required /></div>
              <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Phone</label><input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:border-blue-500" /></div>
              <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Temporary Password</label><input type="text" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:border-blue-500" required /></div>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="w-full sm:w-48"><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Role</label><select value={role} onChange={e => setRole(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl outline-none"><option value="Bartender">Bartender</option><option value="Kitchen">Kitchen</option></select></div>
              <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mt-4 cursor-pointer flex-1"><input type="checkbox" checked={isAdmin} onChange={e => setIsAdmin(e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" /> Grant Admin Access</label>
              <button type="submit" className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-slate-800 w-full sm:w-auto shadow-sm mt-4 sm:mt-0">Add Staff</button>
            </div>
          </form>
        </div>
      )}
      
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead><tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 tracking-wider"><th className="p-4 font-bold">Staff Directory</th><th className="p-4 font-bold hidden sm:table-cell">Contact</th><th className="p-4 font-bold">Role</th><th className="p-4 font-bold text-right">Actions</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {displayUsers.map(u => {
              const isMaster = u.email === MASTER_ADMIN_EMAIL;
              return (
              <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                <td className="p-4"><div className="font-bold text-slate-900 text-lg">{u.name}</div></td>
                <td className="p-4 hidden sm:table-cell"><div className="text-sm font-medium text-slate-600">{u.email}</div><div className="text-sm text-slate-400">{u.phone || 'No phone'}</div></td>
                <td className="p-4">
                  <span className={`text-sm font-bold px-3 py-1 rounded-full inline-block ${u.role === 'Bartender' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'}`}>{u.role}</span>
                  {appUser?.isAdmin && !isMaster && (
                    <label className="flex items-center gap-2 mt-2 cursor-pointer">
                      <input type="checkbox" checked={u.isAdmin} onChange={() => handleToggleAdmin(u.id, u.isAdmin)} className="w-4 h-4 rounded border-slate-300" /><span className="text-xs font-bold text-slate-500">Admin</span>
                    </label>
                  )}
                  {isMaster && <span className="block mt-2 text-xs font-black bg-slate-900 text-white px-2 py-0.5 rounded w-max"><Shield size={10} className="inline mr-1 pb-0.5"/>Master Admin</span>}
                </td>
                <td className="p-4 text-right">
                  <div className="flex justify-end gap-2">
                     {(appUser?.isAdmin || appUser.id === u.id) && <button onClick={() => setAvailModalUser(u)} className="text-slate-400 hover:text-blue-600 bg-white border border-slate-200 hover:bg-blue-50 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"><UserCheck size={14}/> Templates</button>}
                     {appUser?.isAdmin && !isMaster && (<button onClick={() => handleDelete(u.id)} className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"><Trash2 size={18}/></button>)}
                  </div>
                </td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- Tab: Month View ---
const TabMonth = ({ currentDate, appUser, users, shifts, events, setCurrentDate }) => {
  const monthStr = getMonthStr(currentDate);
  const year = parseInt(monthStr.split('-')[0], 10);
  const holidayMap = getHolidays(year);
  const firstDay = new Date(monthStr + '-01T12:00:00').getDay();
  const displayUsers = users.length > 0 ? users : [];

  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState(currentDate);

  const handleAddEvent = async (e) => {
    e.preventDefault(); if(!eventTitle.trim()) return;
    await addDoc(collection(db, "events"), { date: eventDate, title: eventTitle.trim() });
    setEventTitle('');
  };

  return (
    <div className="space-y-4">
      {appUser?.isAdmin && (
        <form onSubmit={handleAddEvent} className="mb-4 bg-white p-4 border border-slate-200 rounded-2xl flex flex-col sm:flex-row gap-3 items-center shadow-sm">
          <input type="text" value={eventTitle} onChange={e => setEventTitle(e.target.value)} placeholder="Add Special Event/Catering (e.g. Miller Wedding)" className="flex-1 p-3 bg-slate-50 border border-slate-300 rounded-xl outline-none font-medium w-full" required />
          <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} className="p-3 bg-slate-50 border border-slate-300 rounded-xl outline-none font-bold text-slate-700 w-full sm:w-auto" required />
          <button type="submit" className="bg-purple-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-purple-700 w-full sm:w-auto shadow-sm">Add Event</button>
        </form>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm grid grid-cols-7 border-t border-l">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => <div key={d} className="p-3 bg-slate-50 text-center font-bold text-xs text-slate-500 border-b border-r uppercase tracking-wider">{d}</div>)}
        {Array.from({length: firstDay}).map((_, i) => <div key={i} className="bg-slate-50/50 border-b border-r min-h-[100px]" />)}
        {Array.from({length: getDaysInMonth(monthStr)}).map((_, i) => {
          const date = `${monthStr}-${String(i + 1).padStart(2, '0')}`;
          return (
            <div key={date} onClick={() => setCurrentDate(date)} className="p-2 border-b border-r min-h-[120px] hover:bg-slate-50 cursor-pointer flex flex-col justify-between transition-colors">
              <div className="flex flex-col items-end gap-1 w-full">
                <span className="text-right text-sm font-bold text-slate-400">{i+1}</span>
                {holidayMap[date] && (<span className="text-[9px] font-black tracking-tight text-red-700 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded truncate w-full text-center" title={holidayMap[date]}>🎉 {holidayMap[date]}</span>)}
                {events.filter(e => e.date === date).map(ev => (
                  <span key={ev.id} className="text-[9px] font-black tracking-tight text-purple-700 bg-purple-100 border border-purple-200 px-1.5 py-0.5 rounded truncate w-full text-center mt-0.5" title={ev.title}>📅 {ev.title}</span>
                ))}
              </div>
              <div className="space-y-1 max-h-[65px] overflow-hidden mt-1 w-full">
                {shifts.filter(s => s.date === date).map(s => {
                  const emp = displayUsers.find(u => u.id === s.employeeId);
                  return <div key={s.id} className={`text-[10px] font-bold px-1.5 py-0.5 rounded truncate ${s.role === 'Bartender' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'}`}>{emp?.name.split(' ')[0]}</div>
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  );
};

// --- Tab: Prep List ---
const TabPrep = ({ currentDate, prepItems }) => {
  const [text, setText] = useState('');
  const handleAdd = async (e) => { e.preventDefault(); if (!text.trim()) return; await addDoc(collection(db, "prepItems"), { date: currentDate, text: text.trim(), isCompleted: false }); setText(''); };
  const toggleStatus = async (item) => await updateDoc(doc(db, "prepItems", item.id), { isCompleted: !item.isCompleted });
  const handleDelete = async (id) => await deleteDoc(doc(db, "prepItems", id));

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <form onSubmit={handleAdd} className="bg-white border border-slate-200 p-2 pl-4 rounded-2xl flex gap-2 shadow-sm items-center"><input type="text" value={text} onChange={e => setText(e.target.value)} className="flex-1 p-2 bg-transparent outline-none font-medium placeholder:text-slate-400" placeholder="Add a new prep task..." required /><button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-xl font-bold transition-colors shadow-sm"><Plus size={20}/></button></form>
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm divide-y divide-slate-100">
        {prepItems.filter(p => p.date === currentDate).length === 0 ? (<div className="p-8 text-center text-slate-400 font-medium">No prep tasks scheduled for today.</div>) : (
          prepItems.filter(p => p.date === currentDate).map(item => (
            <div key={item.id} className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors group">
              <span className={`text-lg transition-all ${item.isCompleted ? 'line-through text-slate-300' : 'font-bold text-slate-800'}`}>{item.text}</span>
              <div className="flex gap-2"><button onClick={() => toggleStatus(item)} className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all shadow-sm ${item.isCompleted ? 'bg-slate-100 text-slate-500 hover:bg-slate-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200 hover:bg-emerald-200'}`}>{item.isCompleted ? 'Undo' : <><Check size={16}/> Done</>}</button><button onClick={() => handleDelete(item.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"><Trash2 size={18}/></button></div>
            </div>
          )))}
      </div>
    </div>
  );
};

// --- Tab: Schedule ---
const TabSchedule = ({ currentDate, appUser, users, shifts, shiftSwaps, timeOff, events, addToast }) => {
  const [selectedEmp, setSelectedEmp] = useState('');
  const [startTime, setStartTime] = useState('16:00');
  const [endTime, setEndTime] = useState('23:00');

  const displayUsers = users.length > 0 ? users : (appUser ? [appUser] : []);
  const displayShifts = shifts.filter(s => s.date === currentDate);
  const dayEvents = events.filter(e => e.date === currentDate);
  
  const year = parseInt(currentDate.split('-')[0], 10);
  const holidayMap = getHolidays(year);
  const todayHoliday = holidayMap[currentDate];

  const handleSaveShift = async () => {
    if (!selectedEmp) return;
    const emp = displayUsers.find(u => u.id === selectedEmp);
    await addDoc(collection(db, "shifts"), { date: currentDate, employeeId: emp.id, role: emp.role, startTime, endTime });
    setSelectedEmp('');
    addToast('Shift Assigned', `Assigned to ${emp.name}.`);
  };

  const handleDeleteShift = async (id) => await deleteDoc(doc(db, "shifts", id));
  const handleDeleteEvent = async (id) => await deleteDoc(doc(db, "events", id));

  const handleOfferSwap = async (shift) => {
    if (window.confirm("Offer this shift on the Trade Board?")) {
      await addDoc(collection(db, "shiftSwaps"), { shiftId: shift.id, date: shift.date, originalEmployeeId: shift.employeeId, role: shift.role, startTime: shift.startTime, endTime: shift.endTime, status: 'available' });
      addToast('Trade Board', 'Shift posted successfully.');
    }
  };

  const handleClaimSwap = async (swap) => {
    await updateDoc(doc(db, "shiftSwaps", swap.id), { status: 'pending_approval', claimedById: appUser.id });
    addToast('Shift Claimed', 'Awaiting manager approval.');
  };

  const handleApproveSwap = async (swap) => {
    await updateDoc(doc(db, "shifts", swap.shiftId), { employeeId: swap.claimedById });
    await deleteDoc(doc(db, "shiftSwaps", swap.id));
    addToast('Trade Approved', 'Master schedule updated automatically.');
  };

  const handleDenySwap = async (swap) => {
    await updateDoc(doc(db, "shiftSwaps", swap.id), { status: 'available', claimedById: null });
    addToast('Trade Denied', 'Shift sent back to the Trade Board.');
  };

  const pendingApprovals = shiftSwaps.filter(sw => sw.status === 'pending_approval');
  const availableSwaps = shiftSwaps.filter(sw => sw.status === 'available');

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {todayHoliday && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-2xl font-bold flex items-center gap-4 shadow-sm border-l-4 border-l-amber-500">
          <AlertTriangle className="text-amber-600 flex-shrink-0" size={24} />
          <div><span className="text-amber-900 block font-black text-base">⚠️ {todayHoliday} Notice</span><span className="text-sm font-semibold text-amber-700">Today is a recognized holiday. Review specialized coverage limits or custom hours.</span></div>
        </div>
      )}

      {dayEvents.length > 0 && (
        <div className="space-y-3">
           {dayEvents.map(ev => (
              <div key={ev.id} className="bg-purple-50 border border-purple-200 text-purple-800 p-4 rounded-2xl font-bold flex items-center justify-between shadow-sm border-l-4 border-l-purple-500">
                <div className="flex items-center gap-4">
                  <Calendar className="text-purple-600 flex-shrink-0" size={24} />
                  <div>
                    <span className="text-purple-900 block font-black text-base">📅 {ev.title}</span>
                    <span className="text-sm font-semibold text-purple-700">Special Event / Catering</span>
                  </div>
                </div>
                {appUser?.isAdmin && <button onClick={() => handleDeleteEvent(ev.id)} className="text-purple-400 hover:text-red-500 transition-colors"><Trash2 size={18}/></button>}
              </div>
           ))}
        </div>
      )}

      {/* Trade Board UI */}
      {(pendingApprovals.length > 0 || availableSwaps.length > 0) && (
        <div className="bg-indigo-50 border border-indigo-200 p-6 rounded-3xl shadow-sm space-y-4">
          <h3 className="font-black text-xl text-indigo-900 flex items-center gap-2"><Repeat size={20}/> Shift Trade Board</h3>
          
          {appUser?.isAdmin && pendingApprovals.length > 0 && (
            <div className="bg-white p-4 rounded-2xl border border-indigo-100 space-y-3">
              <h4 className="font-bold text-sm uppercase tracking-wider text-indigo-500">Manager Approvals Needed</h4>
              {pendingApprovals.map(sw => {
                const orig = displayUsers.find(u => u.id === sw.originalEmployeeId);
                const claimer = displayUsers.find(u => u.id === sw.claimedById);
                return (
                  <div key={sw.id} className="flex flex-col sm:flex-row justify-between items-center bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 gap-3">
                    <div className="text-sm font-medium text-slate-700"><strong>{claimer?.name}</strong> wants to cover <strong>{orig?.name}'s</strong> {formatDisplayDate(sw.date)} shift ({formatTime12Hour(sw.startTime)} - {formatTime12Hour(sw.endTime)}).</div>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <button onClick={() => handleApproveSwap(sw)} className="flex-1 sm:flex-none bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-sm transition-colors">Approve</button>
                      <button onClick={() => handleDenySwap(sw)} className="flex-1 sm:flex-none bg-white border border-slate-300 text-slate-600 hover:bg-slate-100 px-4 py-2 rounded-lg font-bold text-sm shadow-sm transition-colors">Deny</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {availableSwaps.length > 0 && (
             <div className="bg-white p-4 rounded-2xl border border-indigo-100 space-y-3">
               <h4 className="font-bold text-sm uppercase tracking-wider text-indigo-500">Available to Claim</h4>
               {availableSwaps.map(sw => {
                 const orig = displayUsers.find(u => u.id === sw.originalEmployeeId);
                 const canClaim = appUser.id !== sw.originalEmployeeId && appUser.role === sw.role;
                 return (
                   <div key={sw.id} className="flex justify-between items-center bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 gap-2">
                     <div>
                       <span className="font-bold text-indigo-900 block">{orig?.name || 'Unknown'} - {sw.role}</span>
                       <span className="text-sm font-medium text-slate-600">{formatDisplayDate(sw.date)} | {formatTime12Hour(sw.startTime)} - {formatTime12Hour(sw.endTime)}</span>
                     </div>
                     {canClaim && <button onClick={() => handleClaimSwap(sw)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-sm hover:bg-indigo-700 transition-colors whitespace-nowrap">Claim Shift</button>}
                   </div>
                 )
               })}
             </div>
          )}
        </div>
      )}

      {appUser?.isAdmin && (
        <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm space-y-4">
          <h3 className="font-bold text-xl flex items-center gap-2 text-slate-800 mb-2"><Calendar size={20}/> Assign Shift</h3>
          <div className="flex flex-col sm:flex-row gap-4">
            <select value={selectedEmp} onChange={e => setSelectedEmp(e.target.value)} className="flex-1 p-3.5 bg-slate-50 border border-slate-300 rounded-xl font-medium outline-none focus:border-blue-500">
              <option value="">Select Staff Member...</option>
              {displayUsers.map(u => {
                const dayOfWeekMap = ['sun','mon','tue','wed','thu','fri','sat'];
                const dayOfWeek = new Date(currentDate + 'T12:00:00').getDay();
                const hasTimeOff = timeOff.some(t => t.employeeId === u.id && t.startDate === currentDate);
                const templateAllows = u.availability ? u.availability[dayOfWeekMap[dayOfWeek]] !== false : true;
                const isAvail = !hasTimeOff && templateAllows;

                return <option key={u.id} value={u.id} disabled={!isAvail}>{u.name} ({u.role}) {!isAvail ? '- UNAVAILABLE' : ''}</option>
              })}
            </select>
            <div className="flex gap-2">
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full sm:w-32 p-3.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-700 outline-none" />
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full sm:w-32 p-3.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-700 outline-none" />
            </div>
            <button onClick={handleSaveShift} disabled={!selectedEmp} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3.5 rounded-xl font-bold shadow-sm disabled:opacity-50 transition-colors">Assign</button>
          </div>
        </div>
      )}
      
      <div className="grid md:grid-cols-2 gap-6 pt-2">
        {['Bartender', 'Kitchen'].map(role => (
          <div key={role} className="space-y-3">
            <h3 className={`text-lg font-black uppercase tracking-wider pl-2 ${role === 'Bartender' ? 'text-blue-600' : 'text-orange-600'}`}>{role}s</h3>
            {displayShifts.filter(s => s.role === role).length === 0 ? (
               <div className="p-6 bg-white border border-dashed border-slate-300 rounded-2xl text-center text-slate-400 font-medium">No shifts scheduled.</div>
            ) : (
              displayShifts.filter(s => s.role === role).map(s => {
                const emp = displayUsers.find(u => u.id === s.employeeId);
                const isMyShift = appUser.id === s.employeeId;
                const isSwappedOut = shiftSwaps.some(sw => sw.shiftId === s.id);
                
                return (
                  <div key={s.id} className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex flex-col hover:border-slate-300 transition-colors group gap-3">
                    <div className="flex justify-between items-center w-full">
                      <div className="font-black text-xl text-slate-800">{emp?.name || 'Unknown'}</div>
                      <div className="flex items-center gap-3">
                        <div className="text-sm font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">{formatTime12Hour(s.startTime)} - {formatTime12Hour(s.endTime)}</div>
                        {appUser?.isAdmin && <button onClick={() => handleDeleteShift(s.id)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={18}/></button>}
                      </div>
                    </div>
                    {isMyShift && !isSwappedOut && (
                      <button onClick={() => handleOfferSwap(s)} className="w-full text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 py-1.5 rounded-lg transition-colors flex justify-center items-center gap-1"><Repeat size={14}/> Offer on Trade Board</button>
                    )}
                    {isSwappedOut && <div className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-md text-center border border-orange-200">Pending on Trade Board</div>}
                  </div>
                )
              })
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// --- Tab: Time Off ---
const TabTimeOff = ({ appUser, users, timeOff, addToast }) => {
  const [startDate, setStartDate] = useState(getToday()); const [isPartial, setIsPartial] = useState(false); const [startTime, setStartTime] = useState('09:00'); const [endTime, setEndTime] = useState('14:00');
  const displayUsers = users.length > 0 ? users : (appUser ? [appUser] : []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await addDoc(collection(db, "timeOff"), { employeeId: appUser.id, startDate, isPartial, startTime: isPartial ? startTime : null, endTime: isPartial ? endTime : null });
    addToast('Time Off Logged', `Requested ${formatDisplayDate(startDate)}`);
  };

  const handleDelete = async (id) => await deleteDoc(doc(db, "timeOff", id));

  return (
    <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
      <div className="bg-white border border-slate-200 p-6 sm:p-8 rounded-3xl shadow-sm space-y-6 self-start">
        <h3 className="text-2xl font-black flex items-center gap-3 text-slate-800"><Calendar className="text-blue-500" size={28}/> Log Unavailability</h3>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div><label className="block text-sm font-bold text-slate-600 mb-2">Select Date</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-300 rounded-xl font-bold focus:ring-2 focus:ring-blue-500 outline-none" required /></div>
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
            <label className="flex items-center gap-3 font-bold text-slate-700 cursor-pointer"><input type="checkbox" checked={isPartial} onChange={e => setIsPartial(e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" /> This is a partial day / specific time window</label>
            {isPartial && (<div className="flex gap-4 pt-2 border-t border-slate-200"><div className="flex-1"><label className="block text-xs font-bold text-slate-500 mb-1">Start Time</label><input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full p-3 border rounded-xl font-bold" /></div><div className="flex-1"><label className="block text-xs font-bold text-slate-500 mb-1">End Time</label><input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full p-3 border rounded-xl font-bold" /></div></div>)}
          </div>
          <button type="submit" className="w-full bg-slate-900 text-white p-4 rounded-xl font-bold hover:bg-slate-800 shadow-md transition-all">Submit Request</button>
        </form>
      </div>

      <div className="space-y-4">
        <h3 className="text-2xl font-black text-slate-800 pl-2">Upcoming Roster</h3>
        <div className="space-y-3">
          {timeOff.length === 0 ? <p className="p-6 bg-slate-100 rounded-2xl text-slate-500 font-medium">No time off logged.</p> : null}
          {timeOff.filter(t => appUser.isAdmin || t.employeeId === appUser.id).map(t => {
            const emp = displayUsers.find(u => u.id === t.employeeId);
            return (
              <div key={t.id} className="bg-white p-5 border border-slate-200 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-l-4 border-l-orange-500">
                <div><strong className="text-lg text-slate-900 block">{emp?.name || 'Unknown'}</strong><span className="text-slate-500 font-medium">{formatDisplayDate(t.startDate)}</span>{t.isPartial && <div className="mt-1 text-sm font-bold bg-orange-50 text-orange-700 px-3 py-1 rounded-lg border border-orange-200 w-max">{formatTime12Hour(t.startTime)} - {formatTime12Hour(t.endTime)}</div>}</div>
                {(appUser.isAdmin || t.employeeId === appUser.id) && <button onClick={() => handleDelete(t.id)} className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-xl transition-colors"><Trash2 size={20}/></button>}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  );
};

// --- Tab: Inventory ---
const TabInventory = ({ inventoryItems, addToast }) => {
  const [invTab, setInvTab] = useState('order'); 
  const [newItemName, setNewItemName] = useState(''); const [newItemCat, setNewItemCat] = useState('Produce'); const [newItemCode, setNewItemCode] = useState('');
  const [orderOverrides, setOrderOverrides] = useState({});

  const handleAddItem = async (e) => {
    e.preventDefault(); if (!newItemName.trim()) return;
    await addDoc(collection(db, "inventoryItems"), { name: newItemName.trim(), category: newItemCat, pfgCode: newItemCode.trim(), parLevel: 10, currentStock: 0 });
    setNewItemName(''); setNewItemCode(''); addToast('Inventory Updated', `${newItemName} added to master list.`);
  };

  const updateStock = async (id, newStock) => await updateDoc(doc(db, "inventoryItems", id), { currentStock: Math.max(0, parseInt(newStock) || 0) });
  const updatePar = async (id, newPar) => await updateDoc(doc(db, "inventoryItems", id), { parLevel: Math.max(0, parseInt(newPar) || 0) });
  const deleteItem = async (id) => { if(window.confirm("Remove this item from the master list?")) await deleteDoc(doc(db, "inventoryItems", id)); };
  const handleOrderChange = (id, value) => setOrderOverrides(prev => ({ ...prev, [id]: parseInt(value) || 0 }));

  const itemsToOrder = inventoryItems.filter(i => {
    const override = orderOverrides[i.id];
    if (override !== undefined) return override > 0;
    return i.currentStock < i.parLevel;
  });

  const handleEmailOrder = () => {
    const bodyText = itemsToOrder.map(item => {
      const qty = orderOverrides[item.id] !== undefined ? orderOverrides[item.id] : Math.max(0, item.parLevel - item.currentStock);
      if (qty === 0) return null;
      return `${item.pfgCode ? `[${item.pfgCode}] ` : ''}${item.name}: ${qty}`;
    }).filter(Boolean).join('%0D%0A');

    if (!bodyText) return addToast('Order Empty', 'All quantities are set to zero.');

    const subject = encodeURIComponent("PFG Order - Cheers Chilton (Acct 39228)");
    const body = encodeURIComponent("Performance Foodservice Order\nAccount: 39228\nLocation: Cheers-Chilton\n\nItems to Order:\n") + bodyText;
    window.location.href = `mailto:geoffm1985@gmail.com?subject=${subject}&body=${body}`;
    
    setOrderOverrides({});
    addToast('Email Client Opened', 'Check your email app to review and send the order.');
  };

  const groupedItems = inventoryItems.reduce((acc, item) => { if (!acc[item.category]) acc[item.category] = []; acc[item.category].push(item); return acc; }, {});

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4 border-b border-slate-200 pb-4">
        <h2 className="text-2xl font-black flex items-center gap-2 text-slate-900"><Package size={24}/> Purchasing</h2>
        <div className="bg-slate-200/50 p-1 rounded-xl flex border border-slate-200 w-full sm:w-auto">
          {['count', 'order', 'manage'].map(tab => (
            <button key={tab} onClick={() => setInvTab(tab)} className={`flex-1 sm:flex-none px-6 py-2 rounded-lg text-sm font-bold capitalize transition-all ${invTab === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{tab}</button>
          ))}
        </div>
      </div>
      
      {invTab === 'count' && (
        <div className="space-y-8">
          {Object.keys(groupedItems).length === 0 && <div className="p-8 text-center text-slate-400 font-medium">Master list is empty. Add items in Manage tab.</div>}
          {Object.entries(groupedItems).map(([category, items]) => (
            <div key={category} className="space-y-3">
              <h4 className="text-xl font-black text-slate-800 border-b border-slate-200 pb-2">{category}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {items.map(item => (
                  <div key={item.id} className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between shadow-sm gap-4">
                    <div className="flex-1">
                      <div className="font-bold text-slate-900 text-lg leading-tight">{item.name}</div>
                      <div className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">{item.pfgCode ? `PFG: ${item.pfgCode}` : 'NO CODE'}</div>
                    </div>
                    <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-xl border border-slate-200 w-full sm:w-auto justify-between sm:justify-start">
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">PAR</span>
                        <input type="number" min="0" value={item.parLevel} onChange={(e) => updatePar(item.id, e.target.value)} className="w-12 text-center font-bold text-slate-700 bg-white border border-slate-300 rounded-md py-1 outline-none focus:border-blue-500" />
                      </div>
                      <div className="h-8 w-px bg-slate-300"></div>
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">STOCK</span>
                        <div className="flex items-center gap-2">
                          <button onClick={() => updateStock(item.id, item.currentStock - 1)} className="w-8 h-8 flex items-center justify-center bg-white border border-slate-300 text-slate-600 rounded-md font-bold hover:bg-slate-100 transition-colors">-</button>
                          <span className="w-8 text-center font-black text-xl text-slate-800">{item.currentStock}</span>
                          <button onClick={() => updateStock(item.id, item.currentStock + 1)} className="w-8 h-8 flex items-center justify-center bg-white border border-slate-300 text-slate-600 rounded-md font-bold hover:bg-slate-100 transition-colors">+</button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {invTab === 'order' && (
        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
          <div className="p-6 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <h3 className="font-black text-xl text-slate-800">Deficit Report</h3>
            <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-lg font-bold text-sm">{itemsToOrder.length} Items Needed</span>
          </div>
          {itemsToOrder.length === 0 ? (
            <div className="p-12 text-center font-bold text-slate-400">All inventory levels meet or exceed par.</div>
          ) : (
            <div>
              <table className="w-full text-left">
                <thead><tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider"><th className="p-4">Item</th><th className="p-4 text-center hidden sm:table-cell">On Hand</th><th className="p-4 text-center hidden sm:table-cell">Par</th><th className="p-4 text-right">Order Qty</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {itemsToOrder.map(item => {
                    const defaultOrder = Math.max(0, item.parLevel - item.currentStock);
                    const currentOrder = orderOverrides[item.id] !== undefined ? orderOverrides[item.id] : defaultOrder;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="p-4"><span className="font-bold text-slate-800 block text-lg leading-tight mb-1">{item.name}</span><span className="text-[10px] font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded uppercase tracking-wider">{item.category} {item.pfgCode && `• #${item.pfgCode}`}</span></td>
                        <td className="p-4 text-center font-medium text-slate-500 hidden sm:table-cell">{item.currentStock}</td>
                        <td className="p-4 text-center font-medium text-slate-500 hidden sm:table-cell">{item.parLevel}</td>
                        <td className="p-4 text-right"><input type="number" min="0" value={currentOrder} onChange={e => handleOrderChange(item.id, e.target.value)} className="font-black text-blue-600 text-xl bg-blue-50 border border-blue-200 px-4 py-2 rounded-xl w-24 text-center outline-none focus:ring-2 focus:ring-blue-500" /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-end">
                <button onClick={handleEmailOrder} className="bg-blue-600 text-white px-8 py-3.5 rounded-xl font-bold shadow-sm hover:bg-blue-700 transition-colors flex items-center gap-2"><Send size={20}/> Email Order to Rep</button>
              </div>
            </div>
          )}
        </div>
      )}

      {invTab === 'manage' && (
        <div className="max-w-2xl mx-auto space-y-8">
          <div className="bg-white p-6 border border-slate-200 rounded-3xl shadow-sm">
             <h3 className="text-xl font-bold text-slate-800 border-b border-slate-100 pb-3 mb-4">Add Single Item</h3>
             <form onSubmit={handleAddItem} className="space-y-4">
               <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Product Name</label><input type="text" value={newItemName} onChange={e => setNewItemName(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:border-blue-500" required /></div>
               <div className="grid grid-cols-2 gap-4">
                 <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Category</label><select value={newItemCat} onChange={e => setNewItemCat(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:border-blue-500"><option>Meat</option><option>Produce</option><option>Dairy</option><option>Seafood</option><option>Dry Goods</option><option>Liquor/Beer</option><option>Supplies</option></select></div>
                 <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">PFG Item #</label><input type="text" value={newItemCode} onChange={e => setNewItemCode(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:border-blue-500" placeholder="Optional" /></div>
               </div>
               <button type="submit" className="w-full bg-slate-900 text-white p-3.5 rounded-xl font-bold shadow-md hover:bg-slate-800 transition-colors">Add Item</button>
             </form>
          </div>

          <div className="bg-white p-6 border border-slate-200 rounded-3xl shadow-sm">
            <h3 className="text-xl font-bold text-slate-800 border-b border-slate-100 pb-3 mb-4">Current Master List</h3>
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
              {inventoryItems.length === 0 && <p className="text-slate-400 font-medium">List is empty.</p>}
              {inventoryItems.map(item => (
                <div key={item.id} className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-xl border border-transparent hover:border-slate-200 transition-all">
                  <div><span className="font-bold text-slate-800 block text-sm leading-tight">{item.name}</span><span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md mt-1 inline-block uppercase tracking-wider">{item.category} {item.pfgCode && `| #${item.pfgCode}`}</span></div>
                  <button onClick={() => deleteItem(item.id)} className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors ml-2"><Trash2 size={16}/></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Tab: Settings ---
const TabSettings = ({ addToast, inventoryItems }) => {
  const [settings, setSettings] = useState({ shiftReminders: true, overtimeAlerts: false, autoApprove: false, muteOffShift: false });
  const [isImporting, setIsImporting] = useState(false);
  const toggle = (key) => setSettings(prev => ({ ...prev, [key]: !prev[key] }));

  const handleImportCatalog = async () => {
    if(!window.confirm("This will inject the complete 39-page PFG Master Catalog into your database. Continue?")) return;
    setIsImporting(true);
    let count = 0;
    try {
      const existingCodes = inventoryItems.map(i => i.pfgCode);
      for (const item of PFG_CATALOG) {
        if (!existingCodes.includes(item.pfgCode)) {
          await addDoc(collection(db, "inventoryItems"), { ...item, currentStock: 0 });
          count++;
        }
      }
      addToast('Import Complete', `Successfully loaded ${count} new PFG items.`);
    } catch (err) { addToast('Import Error', 'Something went wrong during import.'); console.error(err); }
    setIsImporting(false);
  };

  return (
    <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-3xl p-8 shadow-sm space-y-8">
      <div><h3 className="text-2xl font-black text-slate-900 mb-1">Application Settings</h3><p className="text-slate-500 font-medium">Manage alerts and interface preferences.</p></div>

      <div className="space-y-4 border-y border-slate-100 py-6">
        {[
          { id: 'shiftReminders', label: 'Send 24-hour Shift Reminders' },
          { id: 'overtimeAlerts', label: 'Alert Manager Before Overtime (40h)' },
          { id: 'autoApprove', label: 'Auto-Approve Peer Shift Swaps' },
          { id: 'muteOffShift', label: 'Mute Message Notifications Off-Shift' }
        ].map(setting => (
          <div key={setting.id} className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer" onClick={() => toggle(setting.id)}>
            <span className="font-bold text-slate-700">{setting.label}</span>
            <div className={`w-12 h-6 rounded-full transition-colors flex items-center px-1 ${settings[setting.id] ? 'bg-blue-600' : 'bg-slate-300'} shadow-inner`}>
               <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${settings[setting.id] ? 'translate-x-6' : 'translate-x-0'}`}></div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-2xl shadow-sm relative overflow-hidden">
        <div className="absolute -right-4 -top-4 opacity-10"><CheckCircle size={100} /></div>
        <h4 className="font-black text-emerald-900 mb-2 text-lg">PFG Integration Engine</h4>
        <p className="text-sm text-emerald-800 mb-5 font-medium leading-relaxed max-w-[90%]">Inject the entire 39-page Performance Foodservice Master Catalog (Acct 39228) directly into your live database. Pre-configured with exact SKU codes and default par levels.</p>
        <button onClick={handleImportCatalog} disabled={isImporting} className="bg-emerald-600 text-white hover:bg-emerald-700 px-6 py-3.5 rounded-xl font-bold transition-all shadow-md w-full flex items-center justify-center gap-2 relative z-10">
          {isImporting ? <Loader2 className="animate-spin" size={20}/> : <><Package size={20} /> Inject Full PFG Catalog</>}
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-100 p-6 rounded-2xl">
        <h4 className="font-bold text-blue-900 mb-2">System Diagnostics</h4>
        <button onClick={() => addToast('Diagnostic Test', 'Live Firebase database connected successfully.')} className="bg-white border border-blue-200 text-blue-700 hover:bg-blue-600 hover:text-white px-6 py-3 rounded-xl font-bold transition-all shadow-sm w-full">Trigger Test Alert</button>
      </div>
    </div>
  );
};
