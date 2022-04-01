

const obj = {};


const testPromise = (time) => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve(time);
        }, time);
    });
}

const testPromise2 = testPromise(1).then(() => Promise.all([testPromise(2), testPromise(3)]))


console.log(testPromise2);